import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { chain } from "@/lib/config";
import { RelayError, relayFaucet, relayStarterGas } from "@/lib/relayer";

export const runtime = "nodejs";

// Test networks: free test funds. Mainnet: one-off starter fee money (see relayStarterGas). 5 requests per hour per IP.
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  try {
    const { address } = await req.json();
    if (typeof address !== "string" || !isAddress(address)) throw new RelayError("Malformed address.");
    return NextResponse.json(chain.id === 1990 ? await relayStarterGas(address) : await relayFaucet(address));
  } catch (e) {
    const status = e instanceof RelayError ? e.status : 500;
    if (status >= 500) console.error("[faucet]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status });
  }
}
