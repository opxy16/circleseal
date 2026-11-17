"use client";

import { encodeFunctionData, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { AjoForwarderAbi } from "./abi/AjoForwarder";
import { AjoPassbookAbi } from "./abi/AjoPassbook";
import { publicClient } from "./chain";
import { addresses } from "./config";
import { forwardRequestTypes, forwarderDomain, type Contribution, type ForwardRequest, type Payout } from "./eip712";
import { jsonBody } from "./links";

export type RelayResult = { hash: Hex; explorer: string | null };

async function post(body: unknown): Promise<RelayResult> {
  const res = await fetch("/api/relay", { method: "POST", headers: { "content-type": "application/json" }, body: jsonBody(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The relayer couldn't process this. Try again.");
  return data as RelayResult;
}

type PassbookWrite = "createGroup" | "joinWithInvite" | "acceptInvite" | "leaveGroup" | "closeGroup" | "removeMember" | "inviteMember";

/** Sign an AjoPassbook call and have the relayer pay its gas (ERC-2771 forwarder). */
export async function gasless(account: PrivateKeyAccount, functionName: PassbookWrite, args: readonly unknown[]): Promise<RelayResult> {
  const data = encodeFunctionData({ abi: AjoPassbookAbi, functionName, args } as never) as Hex;
  const nonce = await publicClient.readContract({
    address: addresses.forwarder,
    abi: AjoForwarderAbi,
    functionName: "nonces",
    args: [account.address],
  });
  const request: ForwardRequest = {
    from: account.address,
    to: addresses.passbook,
    value: 0n,
    gas: 300_000n,
    nonce,
    deadline: Math.floor(Date.now() / 1000) + 3_600,
    data,
  };
  const signature = await account.signTypedData({
    domain: forwarderDomain(),
    types: forwardRequestTypes,
    primaryType: "ForwardRequest",
    message: request,
  });
  return post({ kind: "forward", request, signature });
}

export function relayContribution(receipt: Contribution, collectorSig: Hex, memberSig: Hex) {
  return post({ kind: "contribution", receipt, collectorSig, memberSig });
}

export function relayPayout(receipt: Payout, collectorSig: Hex, memberSig: Hex) {
  return post({ kind: "payout", receipt, collectorSig, memberSig });
}
