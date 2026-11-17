/**
 * SERVER ONLY. The relayer pays gas for members and collectors.
 * Safety rules:
 *  - Only calls AjoProof's own contracts, and only an allowlist of functions.
 *  - Simulates every call first, so it never pays for a transaction that would fail.
 *  - Sends one transaction at a time and waits for it (QIE rejects out-of-order nonces).
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  decodeFunctionData,
  getAddress,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AjoForwarderAbi } from "./abi/AjoForwarder";
import { AjoPassbookAbi } from "./abi/AjoPassbook";
import { MockStableAbi } from "./abi/MockStable";
import { publicClient } from "./chain";
import { addresses, chain, NETWORK, useLegacyTx } from "./config";
import type { Contribution, ForwardRequest, Payout } from "./eip712";

const ALLOWED_FORWARD_CALLS = new Set([
  "createGroup",
  "joinWithInvite",
  "acceptInvite",
  "inviteMember",
  "leaveGroup",
  "removeMember",
  "closeGroup",
]);
const MAX_FORWARD_GAS = 500_000n;

function relayerAccount() {
  // A per-network key (RELAYER_PRIVATE_KEY_QIETESTNET, ..._QIEMAINNET) wins over the generic one,
  // so switching NEXT_PUBLIC_NETWORK never pays gas from the wrong wallet.
  const pk = (process.env[`RELAYER_PRIVATE_KEY_${NETWORK.toUpperCase()}`] || process.env.RELAYER_PRIVATE_KEY) as Hex | undefined;
  if (!pk) throw new RelayError("The relayer isn't configured yet (RELAYER_PRIVATE_KEY missing).", 503);
  return privateKeyToAccount(pk);
}

export class RelayError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  BadCollectorSignature: "The collector's signature doesn't match this receipt.",
  BadMemberSignature: "Your signature doesn't match this receipt.",
  AlreadyRecorded: "This receipt is already recorded.",
  RefAlreadyUsed: "This payment was already recorded.",
  NotActiveMember: "This wallet isn't an active member of the group.",
  GroupIsClosed: "This group is closed.",
  GroupNotFound: "Group not found.",
  ReceiptInFuture: "The payment date is in the future.",
  InviteExpired: "This invite link has expired. Ask your collector for a new one.",
  InviteAlreadyUsed: "This invite link was already used. Ask your collector for a new one.",
  BadInviteSignature: "This invite link isn't valid.",
  AlreadyMember: "You're already in this group.",
  CollectorCannotBeMember: "The collector can't join their own group as a member.",
  NotCollector: "Only the group's collector can do that.",
};

function explain(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      return FRIENDLY[name] ?? `The blockchain rejected this (${name || "reverted"}).`;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

// One-at-a-time queue.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function send(simulate: () => Promise<{ request: unknown }>): Promise<Hex> {
  const account = relayerAccount();
  const wallet = createWalletClient({ account, chain, transport: http() });
  return enqueue(async () => {
    let request: Parameters<typeof wallet.writeContract>[0];
    try {
      request = (await simulate()).request as typeof request;
    } catch (e) {
      throw new RelayError(explain(e), 422);
    }
    const tx = useLegacyTx ? ({ ...request, type: "legacy" } as typeof request) : request;
    // When hosted serverlessly, two app instances can pick the same nonce at the same moment.
    // The in-memory queue can't see the other instance, so retry a couple of times on a nonce clash.
    let hash: Hex | undefined;
    for (let attempt = 0; !hash; attempt++) {
      try {
        hash = await wallet.writeContract(tx);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (attempt < 2 && /nonce|already known|replacement transaction/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 1_500 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new RelayError("The transaction failed on-chain.", 500);
    return hash;
  });
}

export async function relayContribution(c: Contribution, collectorSig: Hex, memberSig: Hex): Promise<Hex> {
  const account = relayerAccount();
  return send(() =>
    publicClient.simulateContract({
      account,
      address: addresses.passbook,
      abi: AjoPassbookAbi,
      functionName: "recordContribution",
      args: [c, collectorSig, memberSig],
    }),
  );
}

export async function relayPayout(p: Payout, collectorSig: Hex, memberSig: Hex): Promise<Hex> {
  const account = relayerAccount();
  return send(() =>
    publicClient.simulateContract({
      account,
      address: addresses.passbook,
      abi: AjoPassbookAbi,
      functionName: "recordPayout",
      args: [p, collectorSig, memberSig],
    }),
  );
}

export async function relayForward(req: ForwardRequest, signature: Hex): Promise<Hex> {
  if (getAddress(req.to) !== getAddress(addresses.passbook)) throw new RelayError("Only AjoProof calls can be relayed.");
  if (req.value !== 0n) throw new RelayError("Relayed calls can't send value.");
  if (req.gas > MAX_FORWARD_GAS) throw new RelayError("Requested gas is too high.");
  if (req.deadline < Math.floor(Date.now() / 1000)) throw new RelayError("This request has expired. Please try again.");

  let fn: string;
  try {
    fn = decodeFunctionData({ abi: AjoPassbookAbi, data: req.data }).functionName;
  } catch {
    throw new RelayError("Unrecognised action.");
  }
  if (!ALLOWED_FORWARD_CALLS.has(fn)) throw new RelayError(`"${fn}" can't be relayed.`);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nonce: _ignoredNonce, ...rest } = req;
  const data = { ...rest, signature };
  const valid = await publicClient.readContract({
    address: addresses.forwarder,
    abi: AjoForwarderAbi,
    functionName: "verify",
    args: [data],
  });
  if (!valid) throw new RelayError("Signature check failed. Please try again.");

  const account = relayerAccount();
  return send(() =>
    publicClient.simulateContract({
      account,
      address: addresses.forwarder,
      abi: AjoForwarderAbi,
      functionName: "execute",
      args: [data],
    }),
  );
}

/**
 * TEST NETWORKS ONLY: top a wallet up with a little gas and test stablecoin so circle mode
 * can be tried for free. Never runs on mainnet (real QUSDC can't be minted anyway).
 */
// Local chain: plenty. QIE testnet: the public faucet only gives 2 test QIE a day, so hand out a little.
const FAUCET_GAS = parseEther(chain.id === 31337 ? "0.05" : "0.01");
const FAUCET_STABLE = parseUnits("1000", 6);

export async function relayFaucet(to: Address): Promise<{ gas: Hex | null; stable: Hex | null }> {
  if (chain.id === 1990) throw new RelayError("Test funds aren't available on mainnet.", 403);
  if (!addresses.stablecoin) throw new RelayError("No test stablecoin is deployed on this network.", 503);
  const account = relayerAccount();
  const wallet = createWalletClient({ account, chain, transport: http() });
  const tx = useLegacyTx ? ({ type: "legacy" } as const) : {};

  return enqueue(async () => {
    const [gasBal, stableBal] = await Promise.all([
      publicClient.getBalance({ address: to }),
      publicClient.readContract({ address: addresses.stablecoin, abi: MockStableAbi, functionName: "balanceOf", args: [to] }),
    ]);
    if (gasBal >= FAUCET_GAS / 2n && stableBal >= FAUCET_STABLE / 2n) {
      throw new RelayError("This wallet already has test funds.", 429);
    }
    let gas: Hex | null = null;
    let stable: Hex | null = null;
    if (gasBal < FAUCET_GAS / 2n) {
      gas = await wallet.sendTransaction({ to, value: FAUCET_GAS, ...tx } as never);
      await publicClient.waitForTransactionReceipt({ hash: gas });
    }
    if (stableBal < FAUCET_STABLE / 2n) {
      stable = await wallet.writeContract({
        address: addresses.stablecoin,
        abi: MockStableAbi,
        functionName: "mint",
        args: [to, FAUCET_STABLE],
        ...tx,
      } as never);
      await publicClient.waitForTransactionReceipt({ hash: stable });
    }
    return { gas, stable };
  });
}

/**
 * MAINNET ONLY: a one-off sliver of QIE (about $0.0015) so a circle wallet that already holds
 * QUSDC can pay for its first QIEDEX swap (QUSDC -> QIE) and from then on pay its own fees.
 * Only wallets holding at least 1 QUSDC and almost no QIE qualify, so draining it isn't worth it.
 */
const STARTER_GAS = parseEther("0.01");
const STARTER_MIN_QUSDC = parseUnits("1", 6);
const starterGiven = new Set<string>();

export async function relayStarterGas(to: Address): Promise<{ gas: Hex }> {
  if (chain.id !== 1990) throw new RelayError("Starter fees are only for mainnet.", 400);
  if (!addresses.stablecoin) throw new RelayError("Circle mode isn't set up on this network.", 503);
  if (starterGiven.has(to.toLowerCase())) throw new RelayError("This wallet already got its starter fee money.", 429);
  const account = relayerAccount();
  const wallet = createWalletClient({ account, chain, transport: http() });
  return enqueue(async () => {
    const [gasBal, qusdc] = await Promise.all([
      publicClient.getBalance({ address: to }),
      publicClient.readContract({ address: addresses.stablecoin, abi: MockStableAbi, functionName: "balanceOf", args: [to] }),
    ]);
    if (gasBal >= STARTER_GAS / 5n) throw new RelayError("This wallet already has QIE for fees.", 429);
    if (qusdc < STARTER_MIN_QUSDC) throw new RelayError("Add at least 1 QUSDC to this wallet first.", 400);
    starterGiven.add(to.toLowerCase());
    const gas = await wallet.sendTransaction({ to, value: STARTER_GAS, ...(useLegacyTx ? { type: "legacy" } : {}) } as never);
    await publicClient.waitForTransactionReceipt({ hash: gas });
    return { gas };
  });
}
