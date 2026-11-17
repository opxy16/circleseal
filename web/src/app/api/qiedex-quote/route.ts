import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Live QUSDC -> QIE quote from QIEDEX's public API (mainnet). Only the numbers are used: the app
 * builds the swap transaction itself against the official router, so it never signs calldata
 * supplied by a third party.
 */
const QUSDC = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5";

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") ?? "1");
  if (!Number.isFinite(amount) || amount < 0.1 || amount > 100) {
    return NextResponse.json({ error: "Amount must be between 0.1 and 100 QUSDC." }, { status: 400 });
  }
  const url = `https://api.dex.qie.digital/quote?tokenIn=${QUSDC}&tokenOut=QIE&amountInDecimal=${amount}&slippageBps=100`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const q = (await res.json()) as {
      amountIn: string;
      amountOut: string;
      amountOutDecimal: string;
      minAmountOut: string;
      priceImpactPct: number;
      path: string[];
      routerCheck?: { matches?: boolean };
    };
    return NextResponse.json(
      {
        amountIn: q.amountIn,
        amountOut: q.amountOut,
        amountOutDecimal: q.amountOutDecimal,
        minAmountOut: q.minAmountOut,
        priceImpactPct: q.priceImpactPct,
        path: q.path,
        checked: q.routerCheck?.matches === true,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "QIEDEX quote unavailable right now." }, { status: 503 });
  }
}
