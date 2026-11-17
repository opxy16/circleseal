// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @title AjoForwarder
/// @notice Lets members and collectors sign actions (create group, accept invite, leave...)
/// while CircleSeal's relayer pays the gas. Uses OpenZeppelin's audited ERC-2771 forwarder,
/// which checks the signer's nonce and deadline before forwarding the call.
contract AjoForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("AjoForwarder") {}
}
