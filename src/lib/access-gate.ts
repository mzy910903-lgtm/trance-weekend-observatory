export const ACCESS_GATE_COOKIE_NAME = "tw_lab_access";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MIN_SECRET_LENGTH = 32;

function accessPassword() {
  return process.env.ACCESS_GATE_PASSWORD?.trim() || null;
}

function cookieSecret() {
  const secret = process.env.ACCESS_GATE_COOKIE_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function bytesToBase64Url(bytes: Uint8Array) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string) {
  const secret = cookieSecret();
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

async function digest(value: string) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(result));
}

export function isAccessGateConfigured() {
  const password = accessPassword();
  return Boolean(
    password &&
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      cookieSecret(),
  );
}

export async function verifyAccessPassword(candidate: string) {
  const password = accessPassword();
  if (!password || !isAccessGateConfigured()) return false;

  const [candidateDigest, passwordDigest] = await Promise.all([
    digest(candidate),
    digest(password),
  ]);
  return constantTimeEqual(candidateDigest, passwordDigest);
}

export async function createAccessSessionValue() {
  if (!isAccessGateConfigured()) return null;

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const payload = `v1.${expiresAt}.${bytesToBase64Url(nonce)}`;
  const signature = await hmac(payload);
  return signature ? `${payload}.${signature}` : null;
}

export async function verifyAccessSession(value?: string | null) {
  if (!value || !isAccessGateConfigured()) return false;

  const parts = value.split(".");
  if (parts.length !== 4) return false;

  const [version, expiresAtRaw, nonce, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (
    version !== "v1" ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    !/^[A-Za-z0-9_-]{16}$/.test(nonce)
  ) {
    return false;
  }

  const expected = await hmac(`${version}.${expiresAtRaw}.${nonce}`);
  return Boolean(expected && constantTimeEqual(expected, signature));
}

export const accessGateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
  priority: "high" as const,
};
