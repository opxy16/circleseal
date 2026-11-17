import type { Address, Hex } from "viem";
import { addresses, chain } from "./config";

export const passbookDomain = () =>
  ({ name: "AjoProof", version: "1", chainId: chain.id, verifyingContract: addresses.passbook }) as const;

export const forwarderDomain = () =>
  ({ name: "AjoForwarder", version: "1", chainId: chain.id, verifyingContract: addresses.forwarder }) as const;

export const inviteTypes = {
  Invite: [
    { name: "groupId", type: "uint256" },
    { name: "memberCode", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const contributionTypes = {
  Contribution: [
    { name: "groupId", type: "uint256" },
    { name: "member", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "period", type: "uint32" },
    { name: "ref", type: "bytes32" },
    { name: "paidAt", type: "uint64" },
  ],
} as const;

export const payoutTypes = {
  Payout: [
    { name: "groupId", type: "uint256" },
    { name: "member", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "cycle", type: "uint32" },
    { name: "ref", type: "bytes32" },
    { name: "paidAt", type: "uint64" },
  ],
} as const;

export const forwardRequestTypes = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

export type Invite = { groupId: bigint; memberCode: Hex; expiresAt: bigint };
export type Contribution = {
  groupId: bigint;
  member: Address;
  amount: bigint;
  period: number;
  ref: Hex;
  paidAt: bigint;
};
export type Payout = {
  groupId: bigint;
  member: Address;
  amount: bigint;
  cycle: number;
  ref: Hex;
  paidAt: bigint;
};
export type ForwardRequest = {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: number;
  data: Hex;
};
