"use client";

import { createWalletClient, erc20Abi, getAddress, http, parseAbi, type Address } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { publicClient } from "./chain";
import { chain, explorerTx, useLegacyTx } from "./config";

/**
 * QIEDEX (QIE's Uniswap-V2-style DEX) on mainnet: swap a little QUSDC for QIE so a circle wallet
 * can pay its own network fees. Official addresses: https://qiedex.qie.digital/qiedex-contracts
 */
export const QIEDEX = {
  router: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef" as Address,
  wqie: "0x0087904D95BEe9E5F24dc8852804b547981A9139" as Address,
  qusdc: "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5" as Address,
};

/** QIEDEX only exists on QIE mainnet. */
export const qiedexAvailable = chain.id === 1990;

const routerAbi = parseAbi([
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
]);

export type DexQuote = { amountIn: bigint; amountOut: bigint; amountOutDecimal: string; minAmountOut: bigint; priceImpactPct: number };

export async function quoteQusdcToQie(amountQusdc: number): Promise<DexQuote> {
  const res = await fetch(`/api/qiedex-quote?amount=${amountQusdc}`);
  const q = await res.json();
  if (!res.ok) throw new Error(q.error || "QIEDEX quote unavailable.");
  // Only accept the direct QUSDC -> WQIE pool we expect, checked against the router by QIEDEX.
  const path = (q.path as string[]).map((a) => getAddress(a));
  if (path.length !== 2 || path[0] !== QIEDEX.qusdc || path[1] !== getAddress(QIEDEX.wqie) || !q.checked) {
    throw new Error("Unexpected QIEDEX route. Try again later.");
  }
  return {
    amountIn: BigInt(q.amountIn),
    amountOut: BigInt(q.amountOut),
    amountOutDecimal: q.amountOutDecimal,
    minAmountOut: BigInt(q.minAmountOut),
    priceImpactPct: Number(q.priceImpactPct),
  };
}

/** Approve (if needed) and swap QUSDC for native QIE on QIEDEX, from the member's own wallet. */
export async function swapQusdcForQie(account: PrivateKeyAccount, quote: DexQuote) {
  const wallet = createWalletClient({ account, chain, transport: http() });
  const legacy = useLegacyTx ? ({ type: "legacy" } as const) : {};
  const allowance = await publicClient.readContract({
    address: QIEDEX.qusdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, QIEDEX.router],
  });
  if (allowance < quote.amountIn) {
    const { request } = await publicClient.simulateContract({
      account,
      address: QIEDEX.qusdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [QIEDEX.router, quote.amountIn],
    });
    const h = await wallet.writeContract({ ...request, ...legacy } as never);
    await publicClient.waitForTransactionReceipt({ hash: h });
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const { request } = await publicClient.simulateContract({
    account,
    address: QIEDEX.router,
    abi: routerAbi,
    functionName: "swapExactTokensForETH",
    args: [quote.amountIn, quote.minAmountOut, [QIEDEX.qusdc, QIEDEX.wqie], account.address, deadline],
  });
  const hash = await wallet.writeContract({ ...request, ...legacy } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The swap failed on-chain.");
  return { hash, explorer: explorerTx(hash) };
}
