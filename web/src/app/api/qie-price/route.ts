import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";

export const runtime = "nodejs";

/**
 * QIE/USDT price from QIE's official on-chain oracle (Chainlink-style AggregatorV3) on QIE mainnet.
 * Read server-side and cached for a minute, so every visitor doesn't hit the RPC.
 * Feed: https://docs.qie.digital/qie-oracle/deployed-contracts/table-of-assets-contract-mapping
 */
const FEED = "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17" as const;
const RPC = process.env.QIE_MAINNET_RPC || process.env.NEXT_PUBLIC_QIE_MAINNET_RPC || "https://rpc1mainnet.qie.digital";
const STALE_AFTER_S = 6 * 3_600;
const abi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

const client = createPublicClient({ transport: http(RPC, { timeout: 8_000 }) });
let cache: { body: { price: number; updatedAt: number; stale: boolean; feed: string }; at: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.body);
  try {
    const [round, decimals] = await Promise.all([
      client.readContract({ address: FEED, abi, functionName: "latestRoundData" }),
      client.readContract({ address: FEED, abi, functionName: "decimals" }),
    ]);
    const [, answer, , updatedAt] = round;
    if (answer <= 0n) throw new Error("bad answer");
    const body = {
      price: Number(answer) / 10 ** decimals,
      updatedAt: Number(updatedAt),
      stale: Date.now() / 1000 - Number(updatedAt) > STALE_AFTER_S,
      feed: FEED,
    };
    cache = { body, at: Date.now() };
    return NextResponse.json(body, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    if (cache) return NextResponse.json(cache.body); // serve the last good price if the RPC blips
    return NextResponse.json({ error: "Price unavailable." }, { status: 503 });
  }
}
