// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AjoCircle
/// @notice A rotating savings circle (ajo / esusu) enforced by code, in a stablecoin such as QUSDC.
///
/// Rules, fixed when the circle is created:
///  - Every member, including the organizer, posts a bond when joining.
///  - Once started, there is one round per member. In round r, every member pays
///    `contributionAmount`, and the whole pot goes to the member in position r (join order).
///  - Anyone can settle a round after it ends. A member who didn't pay that round has the
///    missed amount taken from their own bond. If their bond can't cover it, the rest is
///    recorded as debt and is deducted from that member's own payout when their turn comes.
///  - Payout holdback: when a member receives the pot, the contract keeps back whatever part of
///    their remaining contributions their bond doesn't already cover, and uses it to prepay their
///    next rounds automatically. So a member who has already been paid can never walk away
///    owing the others: every honest member is made whole.
///  - Deducted debt goes into a reserve that is shared, at the end, by members who never missed.
///  - When every round is settled, each member withdraws what is left of their bond and holdback
///    (+ reserve share).
/// No one, including the organizer and the deployer, can move funds outside these rules.
contract AjoCircle is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant MAX_MEMBERS = 50;
    uint8 public constant MIN_MEMBERS = 2;

    enum Status {
        None,
        Open, // accepting members
        Active, // rounds running
        Completed, // every round settled; withdrawals open
        Cancelled // cancelled before start; bonds refundable
    }

    struct Circle {
        IERC20 token;
        address organizer;
        bytes32 metaHash; // hash of off-chain details (name, rules); never raw PII
        uint128 contributionAmount;
        uint128 bondAmount;
        uint32 roundDuration; // seconds per round
        uint8 maxMembers;
        uint8 memberCount;
        uint8 settledRounds;
        uint64 startTime;
        Status status;
        uint128 reserve; // debt deducted from payouts, shared by members who never missed
        uint8 honestCount; // members with zero misses, computed at completion
    }

    struct MemberState {
        bool joined;
        bool withdrawn;
        uint8 position; // 0-based turn in the rotation (join order)
        uint8 missed; // rounds missed
        uint128 bond; // bond still held for this member
        uint128 debt; // missed amounts the bond could not cover
        uint128 received; // total payout received
        uint128 held; // part of their payout kept back to prepay their remaining rounds
    }

    uint256 public circleCount;
    mapping(uint256 circleId => Circle) private _circles;
    mapping(uint256 circleId => address[]) private _order;
    mapping(uint256 circleId => mapping(address member => MemberState)) private _members;
    mapping(uint256 circleId => mapping(uint256 round => mapping(address member => bool))) public paidInRound;
    mapping(uint256 circleId => mapping(uint256 round => uint128)) public collectedInRound;

    event CircleCreated(
        uint256 indexed circleId,
        address indexed organizer,
        address token,
        uint128 contributionAmount,
        uint128 bondAmount,
        uint32 roundDuration,
        uint8 maxMembers,
        bytes32 metaHash
    );
    event MemberJoined(uint256 indexed circleId, address indexed member, uint8 position);
    event MemberLeft(uint256 indexed circleId, address indexed member);
    event CircleStarted(uint256 indexed circleId, uint64 startTime, uint8 rounds);
    event CircleCancelled(uint256 indexed circleId);
    event Contributed(uint256 indexed circleId, uint256 indexed round, address indexed member, uint128 amount);
    event MissCovered(
        uint256 indexed circleId, uint256 indexed round, address indexed member, uint128 fromBond, uint128 addedDebt
    );
    event RoundSettled(
        uint256 indexed circleId, uint256 indexed round, address indexed recipient, uint128 paidOut, uint128 debtDeducted
    );
    event PayoutHeld(uint256 indexed circleId, uint256 indexed round, address indexed recipient, uint128 held);
    event PaidFromHoldback(uint256 indexed circleId, uint256 indexed round, address indexed member, uint128 amount);
    event CircleCompleted(uint256 indexed circleId, uint128 reserve, uint8 honestCount);
    event Withdrawn(uint256 indexed circleId, address indexed member, uint128 amount);

    error InvalidParams();
    error CircleNotFound(uint256 circleId);
    error WrongStatus(uint256 circleId, Status status);
    error NotOrganizer();
    error AlreadyJoined();
    error NotMember();
    error CircleFull();
    error OrganizerCannotLeave();
    error NotEnoughMembers();
    error RoundNotActive();
    error AlreadyPaid(uint256 round);
    error AlreadyPrepaid(uint256 round);
    error RoundNotOver(uint256 round);
    error NothingToWithdraw();

    // ---------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------

    function createCircle(
        IERC20 token,
        uint128 contributionAmount,
        uint128 bondAmount,
        uint32 roundDuration,
        uint8 maxMembers,
        bytes32 metaHash
    ) external nonReentrant returns (uint256 circleId) {
        if (
            address(token) == address(0) || contributionAmount == 0 || roundDuration == 0
                || maxMembers < MIN_MEMBERS || maxMembers > MAX_MEMBERS
        ) revert InvalidParams();

        circleId = ++circleCount;
        Circle storage c = _circles[circleId];
        c.token = token;
        c.organizer = msg.sender;
        c.metaHash = metaHash;
        c.contributionAmount = contributionAmount;
        c.bondAmount = bondAmount;
        c.roundDuration = roundDuration;
        c.maxMembers = maxMembers;
        c.status = Status.Open;

        emit CircleCreated(
            circleId, msg.sender, address(token), contributionAmount, bondAmount, roundDuration, maxMembers, metaHash
        );

        // The organizer is the first member and posts the same bond as everyone else.
        _join(circleId, c, msg.sender);
    }

    function join(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Open);
        _join(circleId, c, msg.sender);
    }

    /// Members (except the organizer) may leave before the circle starts and get their bond back.
    function leave(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Open);
        if (msg.sender == c.organizer) revert OrganizerCannotLeave();
        MemberState storage m = _members[circleId][msg.sender];
        if (!m.joined) revert NotMember();

        // Remove from the rotation, keeping everyone else's order.
        address[] storage order = _order[circleId];
        uint256 len = order.length;
        for (uint256 i = m.position; i + 1 < len; i++) {
            order[i] = order[i + 1];
            _members[circleId][order[i]].position = uint8(i);
        }
        order.pop();
        c.memberCount -= 1;

        uint128 refund = m.bond;
        delete _members[circleId][msg.sender];
        emit MemberLeft(circleId, msg.sender);
        if (refund > 0) c.token.safeTransfer(msg.sender, refund);
    }

    function cancel(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Open);
        if (msg.sender != c.organizer) revert NotOrganizer();
        c.status = Status.Cancelled;
        emit CircleCancelled(circleId);
    }

    function start(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Open);
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.memberCount < MIN_MEMBERS) revert NotEnoughMembers();
        c.status = Status.Active;
        c.startTime = uint64(block.timestamp);
        emit CircleStarted(circleId, c.startTime, c.memberCount);
    }

    // ---------------------------------------------------------------------
    // Rounds
    // ---------------------------------------------------------------------

    /// Pay this round's contribution. Only possible while the round is open.
    function contribute(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Active);
        MemberState storage m = _members[circleId][msg.sender];
        if (!m.joined) revert NotMember();

        uint256 round = _currentRound(c);
        if (round >= c.memberCount || round < c.settledRounds) revert RoundNotActive();
        if (paidInRound[circleId][round][msg.sender]) revert AlreadyPaid(round);
        // This round will be paid from the member's payout holdback; don't let them pay twice.
        if (m.held >= c.contributionAmount) revert AlreadyPrepaid(round);

        paidInRound[circleId][round][msg.sender] = true;
        collectedInRound[circleId][round] += c.contributionAmount;
        emit Contributed(circleId, round, msg.sender, c.contributionAmount);

        c.token.safeTransferFrom(msg.sender, address(this), c.contributionAmount);
    }

    /// Anyone can settle the next unsettled round once its time is over.
    function settleRound(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        _requireStatus(circleId, c, Status.Active);

        uint256 round = c.settledRounds;
        uint256 roundEnd = uint256(c.startTime) + (round + 1) * uint256(c.roundDuration);
        if (block.timestamp < roundEnd) revert RoundNotOver(round);

        address[] storage order = _order[circleId];
        uint128 amount = c.contributionAmount;
        uint128 pot = collectedInRound[circleId][round];

        for (uint256 i = 0; i < order.length; i++) {
            address who = order[i];
            if (paidInRound[circleId][round][who]) continue;
            MemberState storage m = _members[circleId][who];

            // Prepaid from this member's own payout holdback: counts as paid, not a miss.
            if (m.held >= amount) {
                m.held -= amount;
                pot += amount;
                paidInRound[circleId][round][who] = true;
                collectedInRound[circleId][round] += amount;
                emit PaidFromHoldback(circleId, round, who, amount);
                continue;
            }

            // A real miss: use any holdback left, then the bond; anything still missing becomes debt.
            uint128 fromHeld = m.held;
            m.held = 0;
            uint128 rest = amount - fromHeld;
            uint128 fromBond = m.bond >= rest ? rest : m.bond;
            uint128 addedDebt = rest - fromBond;
            m.bond -= fromBond;
            m.debt += addedDebt;
            m.missed += 1;
            pot += fromHeld + fromBond;
            emit MissCovered(circleId, round, who, fromHeld + fromBond, addedDebt);
        }

        // Pay the round's recipient, minus any debt they owe.
        address recipient = order[round];
        MemberState storage r = _members[circleId][recipient];
        uint128 deducted = r.debt >= pot ? pot : r.debt;
        r.debt -= deducted;
        c.reserve += deducted;
        uint128 paidOut = pot - deducted;
        c.settledRounds = uint8(round + 1);

        paidOut -= _holdBack(circleId, c, round, recipient, paidOut);
        r.received += paidOut;
        emit RoundSettled(circleId, round, recipient, paidOut, deducted);

        if (c.settledRounds == c.memberCount) {
            c.status = Status.Completed;
            uint8 honest;
            for (uint256 i = 0; i < order.length; i++) {
                if (_members[circleId][order[i]].missed == 0) honest++;
            }
            c.honestCount = honest;
            emit CircleCompleted(circleId, c.reserve, honest);
        }

        if (paidOut > 0) c.token.safeTransfer(recipient, paidOut);
    }

    /// After completion (or cancellation): withdraw remaining bond, plus a reserve share if you never missed.
    function withdraw(uint256 circleId) external nonReentrant {
        Circle storage c = _circle(circleId);
        if (c.status != Status.Completed && c.status != Status.Cancelled) revert WrongStatus(circleId, c.status);
        MemberState storage m = _members[circleId][msg.sender];
        if (!m.joined || m.withdrawn) revert NothingToWithdraw();

        uint128 amount = m.bond + m.held;
        if (c.status == Status.Completed && m.missed == 0 && c.honestCount > 0) {
            amount += c.reserve / c.honestCount;
        }
        m.withdrawn = true;
        m.bond = 0;
        m.held = 0;
        if (amount == 0) revert NothingToWithdraw();

        emit Withdrawn(circleId, msg.sender, amount);
        c.token.safeTransfer(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getCircle(uint256 circleId) external view returns (Circle memory) {
        return _circle(circleId);
    }

    function getMembers(uint256 circleId) external view returns (address[] memory) {
        return _order[circleId];
    }

    function getMember(uint256 circleId, address member) external view returns (MemberState memory) {
        return _members[circleId][member];
    }

    /// Round open for contributions right now (memberCount means "all rounds have ended").
    function currentRound(uint256 circleId) external view returns (uint256) {
        Circle storage c = _circle(circleId);
        if (c.status != Status.Active) return type(uint256).max;
        return _currentRound(c);
    }

    function recipientOf(uint256 circleId, uint256 round) external view returns (address) {
        return _order[circleId][round];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _join(uint256 circleId, Circle storage c, address who) internal {
        MemberState storage m = _members[circleId][who];
        if (m.joined) revert AlreadyJoined();
        if (c.memberCount >= c.maxMembers) revert CircleFull();

        m.joined = true;
        m.position = c.memberCount;
        m.bond = c.bondAmount;
        _order[circleId].push(who);
        c.memberCount += 1;
        emit MemberJoined(circleId, who, m.position);

        if (c.bondAmount > 0) c.token.safeTransferFrom(who, address(this), c.bondAmount);
    }

    /// Keep enough of a payout to cover the recipient's remaining contributions beyond what their
    /// bond already secures. The kept amount prepays those rounds at settlement.
    function _holdBack(uint256 circleId, Circle storage c, uint256 round, address recipient, uint128 payout)
        internal
        returns (uint128 held)
    {
        MemberState storage r = _members[circleId][recipient];
        uint256 owed = _outstanding(circleId, c, recipient);
        uint256 secured = uint256(r.bond) + r.held;
        if (owed <= secured) return 0;
        uint256 need = owed - secured;
        held = uint128(need < payout ? need : payout);
        r.held += held;
        emit PayoutHeld(circleId, round, recipient, held);
    }

    /// Contributions `who` still owes for rounds not yet settled and not yet paid.
    function _outstanding(uint256 circleId, Circle storage c, address who) internal view returns (uint256 owed) {
        for (uint256 k = c.settledRounds; k < c.memberCount; k++) {
            if (!paidInRound[circleId][k][who]) owed += c.contributionAmount;
        }
    }

    function _currentRound(Circle storage c) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - c.startTime;
        uint256 round = elapsed / c.roundDuration;
        return round > c.memberCount ? c.memberCount : round;
    }

    function _circle(uint256 circleId) internal view returns (Circle storage c) {
        c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound(circleId);
    }

    function _requireStatus(uint256 circleId, Circle storage c, Status expected) internal view {
        if (c.status != expected) revert WrongStatus(circleId, c.status);
    }
}
