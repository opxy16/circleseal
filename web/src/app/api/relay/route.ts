import { NextRequest, NextResponse } from "next/server";
import { isAddress, isHex, type Hex } from "viem";
import { RelayError, relayContribution, relayForward, relayPayout } from "@/lib/relayer";
import { explorerTx } from "@/lib/config";

export const runtime = "nodejs";

// Simple per-IP rate limit: 40 relays per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

const big = (v: unknown) => BigInt(String(v));
const hex = (v: unknown): Hex => {
  if (typeof v !== "string" || !isHex(v)) throw new RelayError("Malformed request.");
  return v;
};
const addr = (v: unknown) => {
  if (typeof v !== "string" || !isAddress(v)) throw new RelayError("Malformed address.");
  return v;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests. Wait a few minutes." }, { status: 429 });

  try {
    const body = await req.json();
    let hash: Hex;
    switch (body?.kind) {
      case "contribution": {
        const r = body.receipt;
        hash = await relayContribution(
          { groupId: big(r.groupId), member: addr(r.member), amount: big(r.amount), period: Number(r.period), ref: hex(r.ref), paidAt: big(r.paidAt) },
          hex(body.collectorSig),
          hex(body.memberSig),
        );
        break;
      }
      case "payout": {
        const r = body.receipt;
        hash = await relayPayout(
          { groupId: big(r.groupId), member: addr(r.member), amount: big(r.amount), cycle: Number(r.cycle), ref: hex(r.ref), paidAt: big(r.paidAt) },
          hex(body.collectorSig),
          hex(body.memberSig),
        );
        break;
      }
      case "forward": {
        const r = body.request;
        hash = await relayForward(
          { from: addr(r.from), to: addr(r.to), value: big(r.value), gas: big(r.gas), nonce: big(r.nonce), deadline: Number(r.deadline), data: hex(r.data) },
          hex(body.signature),
        );
        break;
      }
      default:
        throw new RelayError("Unknown request type.");
    }
    return NextResponse.json({ hash, explorer: explorerTx(hash) });
  } catch (e) {
    const status = e instanceof RelayError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Something went wrong.";
    if (status >= 500) console.error("[relay]", e);
    return NextResponse.json({ error: message }, { status });
  }
}
