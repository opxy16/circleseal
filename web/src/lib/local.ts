"use client";

/**
 * Device-only notes (never sent anywhere, never on-chain): human-readable group names and
 * member labels. On-chain the contract only stores a hash of the group name and an opaque
 * member code, so no personal data is ever public.
 */
const NAMES = "ajoproof.groupNames.v1";
const LABELS = "ajoproof.memberLabels.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: names just won't persist */
  }
}

export function saveGroupName(groupId: bigint | string, name: string) {
  const all = read<Record<string, string>>(NAMES, {});
  all[String(groupId)] = name;
  write(NAMES, all);
}
export function groupName(groupId: bigint | string): string | null {
  return read<Record<string, string>>(NAMES, {})[String(groupId)] ?? null;
}

export function saveMemberLabel(groupId: bigint | string, memberCode: string, label: string) {
  const all = read<Record<string, Record<string, string>>>(LABELS, {});
  all[String(groupId)] = { ...(all[String(groupId)] ?? {}), [memberCode.toLowerCase()]: label };
  write(LABELS, all);
}
export function memberLabel(groupId: bigint | string, memberCode: string): string | null {
  return read<Record<string, Record<string, string>>>(LABELS, {})[String(groupId)]?.[memberCode.toLowerCase()] ?? null;
}

const CIRCLES = "ajoproof.circleNames.v1";
export function saveCircleName(circleId: bigint | string, name: string) {
  const all = read<Record<string, string>>(CIRCLES, {});
  all[String(circleId)] = name;
  write(CIRCLES, all);
}
export function circleName(circleId: bigint | string): string | null {
  return read<Record<string, string>>(CIRCLES, {})[String(circleId)] ?? null;
}

export const naira =(kobo: bigint | number) =>
  "₦" + (Number(kobo) / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const toKobo = (nairaInput: string) => BigInt(Math.round(Number(nairaInput.replace(/,/g, "")) * 100));
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const periodLabel = (seconds: number) =>
  seconds === 86_400 ? "daily" : seconds === 604_800 ? "weekly" : seconds === 2_592_000 ? "monthly" : `every ${Math.round(seconds / 86_400)} days`;
