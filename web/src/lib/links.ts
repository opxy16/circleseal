/**
 * Shareable links carry signed data in the URL (base64url JSON), so no database is needed:
 * a collector's signature travels to the member over WhatsApp, the member adds theirs,
 * and the relayer puts both on-chain. BigInts are written as strings.
 */
export function encodePayload(obj: unknown): string {
  const json = JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayload<T>(s: string): T | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function appUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function whatsappShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** JSON-safe body for fetch() (bigints as strings). */
export function jsonBody(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}
