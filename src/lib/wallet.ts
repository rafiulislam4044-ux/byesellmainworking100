import { ethers } from "ethers";
import { getAlchemyProvider } from "./provider";

const STORAGE_KEY = "plt_encrypted_wallet";

/**
 * Simple AES-GCM encryption for private key storage.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password).buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptKey(privateKey: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(privateKey)
  );
  // Store as base64: salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptKey(encryptedB64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

export function saveEncryptedKey(encrypted: string) {
  localStorage.setItem(STORAGE_KEY, encrypted);
}

export function loadEncryptedKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredKey() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasStoredKey(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Connect a hot wallet from a raw private key.
 * Returns the connected wallet or throws.
 */
export function connectHotWallet(privateKey: string): ethers.Wallet {
  // Validate hex
  let key = privateKey.trim();
  if (!key.startsWith("0x")) key = "0x" + key;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Invalid private key format");
  }
  const wallet = new ethers.Wallet(key, getAlchemyProvider());
  return wallet;
}

export function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
