"use client";

import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

/**
 * In-app wallet, so members never install anything:
 * a fresh private key is created in the browser and stored ONLY on this device,
 * encrypted with the user's PIN (PBKDF2 + AES-GCM). The key never leaves the device
 * and is never sent to any server; only signatures are.
 */
const STORAGE_KEY = "ajoproof.wallet.v1";
const ITERATIONS = 250_000;

type Stored = { address: Address; salt: string; iv: string; ct: string };

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function storedWalletAddress(): Address | null {
  return readStored()?.address ?? null;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function createWallet(pin: string): Promise<PrivateKeyAccount> {
  if (!isValidPin(pin)) throw new Error("PIN must be exactly 6 digits.");
  const pk = generatePrivateKey();
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(pin, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(pk)));
  const account = privateKeyToAccount(pk);
  const stored: Stored = { address: account.address, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    throw new Error("This browser won't let CircleSeal save your wallet. Turn off private browsing and try again.");
  }
  return account;
}

export async function unlockWallet(pin: string): Promise<PrivateKeyAccount> {
  const stored = readStored();
  if (!stored) throw new Error("No wallet on this device yet.");
  try {
    const key = await deriveKey(pin, fromB64(stored.salt));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(stored.iv) }, key, fromB64(stored.ct));
    return privateKeyToAccount(new TextDecoder().decode(pt) as Hex);
  } catch {
    throw new Error("Wrong PIN. Try again.");
  }
}

export function forgetWallet(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
