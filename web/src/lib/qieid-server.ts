/**
 * SERVER ONLY. QIE ID (.qie names) lookups through QIE's official, read-only MCP server
 * (https://mcp.qie.digital/mcp). QIE ID lives on QIE mainnet; a wallet address is the same on
 * every EVM chain, so a member's .qie name can be shown whichever network the app runs on.
 */
import { getAddress, isAddress, type Address } from "viem";

const ENDPOINT = "https://mcp.qie.digital/mcp";
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { value: string | null; at: number }>();

type ToolResult = { status?: string; name?: string | null; address?: string | null };

let rpcId = 0;
async function callTool(name: string, args: Record<string, string>): Promise<ToolResult | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const text = await res.text();
  // The server answers either as plain JSON or as a single server-sent event ("data: {...}").
  const json = text.trimStart().startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { result?: { structuredContent?: ToolResult } };
    return parsed.result?.structuredContent ?? null;
  } catch {
    return null;
  }
}

function cached(key: string): string | null | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  return undefined;
}

/** The address's primary .qie name, or null if it has none (or the service can't be reached). */
export async function nameOf(address: Address): Promise<string | null> {
  const key = `a:${address.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  let value: string | null = null;
  try {
    const r = await callTool("qie_reverse_lookup", { address: getAddress(address) });
    value = r?.status === "ok" && typeof r.name === "string" && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.qie$/i.test(r.name) ? r.name.toLowerCase() : null;
  } catch {
    return null; // don't cache network failures
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

/** The wallet address a .qie name points to, or null. */
export async function addressOf(name: string): Promise<Address | null> {
  const clean = name.trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.qie$/.test(clean) || clean.length > 128) return null;
  const key = `n:${clean}`;
  const hit = cached(key);
  if (hit !== undefined) return hit as Address | null;
  let value: Address | null = null;
  try {
    const r = await callTool("qie_resolve_name", { name: clean });
    value = r?.status === "ok" && typeof r.address === "string" && isAddress(r.address) ? getAddress(r.address) : null;
  } catch {
    return null;
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}
