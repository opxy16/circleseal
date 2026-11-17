import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addressOf, nameOf } from "@/lib/qieid-server";

export const runtime = "nodejs";

// Read-only lookups. 120 requests per 10 minutes per IP, up to 50 addresses per request.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 120;
const MAX_BATCH = 50;
const hits = new Map<string, number[]>();

/**
 * GET /api/qie-id?addresses=0x..,0x..  -> { names: { "0x..": "tolu.qie" | null } }
 * GET /api/qie-id?name=tolu.qie        -> { address: "0x.." | null }
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const name = req.nextUrl.searchParams.get("name");
  if (name) {
    return NextResponse.json({ address: await addressOf(name) }, { headers: { "cache-control": "public, max-age=300" } });
  }

  const list = (req.nextUrl.searchParams.get("addresses") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0 || list.length > MAX_BATCH || !list.every((a) => isAddress(a))) {
    return NextResponse.json({ error: `Pass 1-${MAX_BATCH} comma-separated addresses.` }, { status: 400 });
  }
  const unique = [...new Set(list.map((a) => a.toLowerCase()))] as Address[];
  const names = Object.fromEntries(await Promise.all(unique.map(async (a) => [a, await nameOf(a)] as const)));
  return NextResponse.json({ names }, { headers: { "cache-control": "public, max-age=300" } });
}
