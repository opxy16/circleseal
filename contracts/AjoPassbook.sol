// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title AjoPassbook
/// @notice A tamper-proof passbook for ajo / esusu / thrift groups.
/// Money never touches this contract: members keep paying their collector in cash or by
/// bank transfer. Each contribution (and each payout) becomes a receipt that BOTH the
/// collector and the member sign, so neither side can later alter or deny it.
/// Anyone (usually a gas-sponsoring relayer) can submit a fully co-signed receipt, and
/// group management calls can be sent gaslessly through an ERC-2771 forwarder.
/// No personal data goes on-chain: members are identified by wallet + an opaque code.
contract AjoPassbook is EIP712, ERC2771Context {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum MemberStatus {
        None,
        Invited,
        Active,
        Left
    }

    struct Group {
        address collector;
        bytes32 metaHash; // hash of off-chain group details (name, rules); never raw PII
        bytes3 currency; // e.g. "NGN"; amounts are in the currency's minor unit (kobo)
        uint128 contributionAmount; // expected amount per contribution
        uint32 periodSeconds; // expected time between contributions (e.g. 86400 = daily)
        uint64 createdAt;
        bool closed;
    }

    struct Member {
        MemberStatus status;
        bytes32 memberCode; // opaque code chosen by the collector, never a name or phone number
        uint32 contributions; // number of recorded contribution receipts
        uint32 payouts; // number of recorded payout receipts
        uint128 totalContributed; // minor units
        uint128 totalReceived; // minor units
        uint32 lastPeriod; // highest period index recorded so far
    }

    /// Lifetime thrift record of one wallet across every group (the portable "savings history").
    struct ThriftRecord {
        uint32 groupsJoined;
        uint32 contributions;
        uint32 payouts;
        uint64 firstActivityAt;
        uint64 lastActivityAt;
    }

    /// A single contribution: `member` paid `amount` to the collector for `period`.
    struct Contribution {
        uint256 groupId;
        address member;
        uint128 amount;
        uint32 period; // 1-based period index within the group (day 1, day 2, ... / week 1, ...)
        bytes32 ref; // unique reference (e.g. random id from the app) so the same payment can't be recorded twice
        uint64 paidAt; // unix time the cash/transfer happened
    }

    /// A single payout: the collector paid `amount` to `member` (e.g. their turn in the rotation).
    struct Payout {
        uint256 groupId;
        address member;
        uint128 amount;
        uint32 cycle; // which rotation/cycle this payout belongs to
        bytes32 ref;
        uint64 paidAt;
    }

    /// A shareable invite link signed by the collector. Whoever redeems it first joins with `memberCode`.
    struct Invite {
        uint256 groupId;
        bytes32 memberCode;
        uint64 expiresAt;
    }

    bytes32 public constant INVITE_TYPEHASH = keccak256("Invite(uint256 groupId,bytes32 memberCode,uint64 expiresAt)");
    bytes32 public constant CONTRIBUTION_TYPEHASH = keccak256(
        "Contribution(uint256 groupId,address member,uint128 amount,uint32 period,bytes32 ref,uint64 paidAt)"
    );
    bytes32 public constant PAYOUT_TYPEHASH = keccak256(
        "Payout(uint256 groupId,address member,uint128 amount,uint32 cycle,bytes32 ref,uint64 paidAt)"
    );

    /// Receipts dated further in the future than this are rejected (clock-skew tolerance).
    uint64 public constant MAX_FUTURE_SKEW = 15 minutes;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 public groupCount;
    mapping(uint256 groupId => Group) private _groups;
    mapping(uint256 groupId => mapping(address member => Member)) private _members;
    mapping(uint256 groupId => uint32) public activeMemberCount;
    mapping(address wallet => ThriftRecord) private _records;

    /// Every recorded receipt's EIP-712 digest, so a receipt can never be recorded twice.
    mapping(bytes32 digest => bool) public isRecorded;
    /// (group, ref) pairs already used, so the same payment can't be re-signed under new terms.
    mapping(uint256 groupId => mapping(bytes32 ref => bool)) public refUsed;
    /// Invite links already redeemed (each link works once).
    mapping(uint256 groupId => mapping(bytes32 memberCode => bool)) public inviteUsed;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event GroupCreated(
        uint256 indexed groupId,
        address indexed collector,
        bytes32 metaHash,
        bytes3 currency,
        uint128 contributionAmount,
        uint32 periodSeconds
    );
    event GroupClosed(uint256 indexed groupId);
    event MemberInvited(uint256 indexed groupId, address indexed member, bytes32 memberCode);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event InviteRedeemed(uint256 indexed groupId, address indexed member, bytes32 memberCode);
    event MemberLeft(uint256 indexed groupId, address indexed member, bool removedByCollector);
    event ContributionRecorded(
        uint256 indexed groupId,
        address indexed member,
        uint32 indexed period,
        uint128 amount,
        bytes32 ref,
        uint64 paidAt,
        bytes32 digest
    );
    event PayoutRecorded(
        uint256 indexed groupId,
        address indexed member,
        uint32 indexed cycle,
        uint128 amount,
        bytes32 ref,
        uint64 paidAt,
        bytes32 digest
    );

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error GroupNotFound(uint256 groupId);
    error GroupIsClosed(uint256 groupId);
    error NotCollector(uint256 groupId, address caller);
    error InvalidAddress();
    error InvalidAmount();
    error InvalidPeriod();
    error AlreadyMember(uint256 groupId, address member);
    error NotInvited(uint256 groupId, address member);
    error NotActiveMember(uint256 groupId, address member);
    error CollectorCannotBeMember();
    error BadCollectorSignature();
    error BadMemberSignature();
    error AlreadyRecorded(bytes32 digest);
    error RefAlreadyUsed(uint256 groupId, bytes32 ref);
    error ReceiptInFuture(uint64 paidAt);
    error InviteExpired(uint64 expiresAt);
    error InviteAlreadyUsed(uint256 groupId, bytes32 memberCode);
    error BadInviteSignature();

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(address trustedForwarder) EIP712("CircleSeal", "1") ERC2771Context(trustedForwarder) {}

    // ---------------------------------------------------------------------
    // Group management (callable directly or gaslessly via the forwarder)
    // ---------------------------------------------------------------------

    function createGroup(bytes32 metaHash, bytes3 currency, uint128 contributionAmount, uint32 periodSeconds)
        external
        returns (uint256 groupId)
    {
        if (contributionAmount == 0) revert InvalidAmount();
        if (periodSeconds == 0) revert InvalidPeriod();

        address collector = _msgSender();
        groupId = ++groupCount;
        _groups[groupId] = Group({
            collector: collector,
            metaHash: metaHash,
            currency: currency,
            contributionAmount: contributionAmount,
            periodSeconds: periodSeconds,
            createdAt: uint64(block.timestamp),
            closed: false
        });
        _touch(collector);

        emit GroupCreated(groupId, collector, metaHash, currency, contributionAmount, periodSeconds);
    }

    function inviteMember(uint256 groupId, address member, bytes32 memberCode) external {
        Group storage g = _openGroupOfCollector(groupId);
        if (member == address(0)) revert InvalidAddress();
        if (member == g.collector) revert CollectorCannotBeMember();
        Member storage m = _members[groupId][member];
        if (m.status == MemberStatus.Active || m.status == MemberStatus.Invited) {
            revert AlreadyMember(groupId, member);
        }
        m.status = MemberStatus.Invited;
        m.memberCode = memberCode;
        emit MemberInvited(groupId, member, memberCode);
    }

    /// The invited member accepts, proving they control the wallet.
    function acceptInvite(uint256 groupId) external {
        Group storage g = _existingGroup(groupId);
        if (g.closed) revert GroupIsClosed(groupId);
        address member = _msgSender();
        Member storage m = _members[groupId][member];
        if (m.status != MemberStatus.Invited) revert NotInvited(groupId, member);
        m.status = MemberStatus.Active;
        activeMemberCount[groupId] += 1;

        ThriftRecord storage r = _records[member];
        r.groupsJoined += 1;
        _touch(member);

        emit MemberJoined(groupId, member);
    }

    /// Join with a collector-signed invite link (no address needed in advance).
    /// Each invite (group + memberCode) can be redeemed once, before it expires.
    function joinWithInvite(Invite calldata inv, bytes calldata collectorSig) external {
        Group storage g = _existingGroup(inv.groupId);
        if (g.closed) revert GroupIsClosed(inv.groupId);
        if (inv.expiresAt < block.timestamp) revert InviteExpired(inv.expiresAt);
        if (inviteUsed[inv.groupId][inv.memberCode]) revert InviteAlreadyUsed(inv.groupId, inv.memberCode);
        if (!SignatureChecker.isValidSignatureNow(g.collector, inviteDigest(inv), collectorSig)) {
            revert BadInviteSignature();
        }

        address member = _msgSender();
        if (member == g.collector) revert CollectorCannotBeMember();
        Member storage m = _members[inv.groupId][member];
        if (m.status == MemberStatus.Active || m.status == MemberStatus.Invited) {
            revert AlreadyMember(inv.groupId, member);
        }

        inviteUsed[inv.groupId][inv.memberCode] = true;
        m.status = MemberStatus.Active;
        m.memberCode = inv.memberCode;
        activeMemberCount[inv.groupId] += 1;

        ThriftRecord storage r = _records[member];
        r.groupsJoined += 1;
        _touch(member);

        emit InviteRedeemed(inv.groupId, member, inv.memberCode);
        emit MemberJoined(inv.groupId, member);
    }

    function leaveGroup(uint256 groupId) external {
        _existingGroup(groupId);
        address member = _msgSender();
        _deactivate(groupId, member, false);
    }

    function removeMember(uint256 groupId, address member) external {
        Group storage g = _existingGroup(groupId);
        if (_msgSender() != g.collector) revert NotCollector(groupId, _msgSender());
        _deactivate(groupId, member, true);
    }

    function closeGroup(uint256 groupId) external {
        Group storage g = _openGroupOfCollector(groupId);
        g.closed = true;
        emit GroupClosed(groupId);
    }

    // ---------------------------------------------------------------------
    // Co-signed receipts (anyone may submit; both signatures are required)
    // ---------------------------------------------------------------------

    function recordContribution(Contribution calldata c, bytes calldata collectorSig, bytes calldata memberSig)
        external
        returns (bytes32 digest)
    {
        Group storage g = _existingGroup(c.groupId);
        if (g.closed) revert GroupIsClosed(c.groupId);
        if (c.amount == 0) revert InvalidAmount();
        if (c.period == 0) revert InvalidPeriod();
        _checkNotFuture(c.paidAt);

        Member storage m = _members[c.groupId][c.member];
        if (m.status != MemberStatus.Active) revert NotActiveMember(c.groupId, c.member);

        digest = contributionDigest(c);
        _consume(c.groupId, c.ref, digest);
        _verifyBoth(g.collector, c.member, digest, collectorSig, memberSig);

        m.contributions += 1;
        m.totalContributed += c.amount;
        if (c.period > m.lastPeriod) m.lastPeriod = c.period;

        ThriftRecord storage r = _records[c.member];
        r.contributions += 1;
        _touch(c.member);

        emit ContributionRecorded(c.groupId, c.member, c.period, c.amount, c.ref, c.paidAt, digest);
    }

    function recordPayout(Payout calldata p, bytes calldata collectorSig, bytes calldata memberSig)
        external
        returns (bytes32 digest)
    {
        Group storage g = _existingGroup(p.groupId);
        if (p.amount == 0) revert InvalidAmount();
        if (p.cycle == 0) revert InvalidPeriod();
        _checkNotFuture(p.paidAt);

        Member storage m = _members[p.groupId][p.member];
        // A payout can still be confirmed after a member leaves or the group closes,
        // so a final payout is never left unrecorded.
        if (m.status == MemberStatus.None || m.status == MemberStatus.Invited) {
            revert NotActiveMember(p.groupId, p.member);
        }

        digest = payoutDigest(p);
        _consume(p.groupId, p.ref, digest);
        _verifyBoth(g.collector, p.member, digest, collectorSig, memberSig);

        m.payouts += 1;
        m.totalReceived += p.amount;

        ThriftRecord storage r = _records[p.member];
        r.payouts += 1;
        _touch(p.member);

        emit PayoutRecorded(p.groupId, p.member, p.cycle, p.amount, p.ref, p.paidAt, digest);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function inviteDigest(Invite calldata inv) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(INVITE_TYPEHASH, inv.groupId, inv.memberCode, inv.expiresAt)));
    }

    function contributionDigest(Contribution calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(CONTRIBUTION_TYPEHASH, c.groupId, c.member, c.amount, c.period, c.ref, c.paidAt))
        );
    }

    function payoutDigest(Payout calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(PAYOUT_TYPEHASH, p.groupId, p.member, p.amount, p.cycle, p.ref, p.paidAt))
        );
    }

    function getGroup(uint256 groupId) external view returns (Group memory) {
        return _existingGroup(groupId);
    }

    function getMember(uint256 groupId, address member) external view returns (Member memory) {
        return _members[groupId][member];
    }

    function thriftRecord(address wallet) external view returns (ThriftRecord memory) {
        return _records[wallet];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _existingGroup(uint256 groupId) internal view returns (Group storage g) {
        g = _groups[groupId];
        if (g.collector == address(0)) revert GroupNotFound(groupId);
    }

    function _openGroupOfCollector(uint256 groupId) internal view returns (Group storage g) {
        g = _existingGroup(groupId);
        if (g.closed) revert GroupIsClosed(groupId);
        if (_msgSender() != g.collector) revert NotCollector(groupId, _msgSender());
    }

    function _deactivate(uint256 groupId, address member, bool byCollector) internal {
        Member storage m = _members[groupId][member];
        if (m.status == MemberStatus.Active) {
            activeMemberCount[groupId] -= 1;
        } else if (m.status != MemberStatus.Invited) {
            revert NotActiveMember(groupId, member);
        }
        m.status = MemberStatus.Left;
        emit MemberLeft(groupId, member, byCollector);
    }

    function _consume(uint256 groupId, bytes32 ref, bytes32 digest) internal {
        if (isRecorded[digest]) revert AlreadyRecorded(digest);
        if (refUsed[groupId][ref]) revert RefAlreadyUsed(groupId, ref);
        isRecorded[digest] = true;
        refUsed[groupId][ref] = true;
    }

    /// Supports both normal wallets (ECDSA) and smart-contract wallets (EIP-1271).
    function _verifyBoth(
        address collector,
        address member,
        bytes32 digest,
        bytes calldata collectorSig,
        bytes calldata memberSig
    ) internal view {
        if (!SignatureChecker.isValidSignatureNow(collector, digest, collectorSig)) revert BadCollectorSignature();
        if (!SignatureChecker.isValidSignatureNow(member, digest, memberSig)) revert BadMemberSignature();
    }

    function _checkNotFuture(uint64 paidAt) internal view {
        if (paidAt > block.timestamp + MAX_FUTURE_SKEW) revert ReceiptInFuture(paidAt);
    }

    function _touch(address wallet) internal {
        ThriftRecord storage r = _records[wallet];
        uint64 nowTs = uint64(block.timestamp);
        if (r.firstActivityAt == 0) r.firstActivityAt = nowTs;
        r.lastActivityAt = nowTs;
    }
}
