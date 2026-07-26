export const ADMIN_COOKIE_NAME = "tw_admin_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : "admin";
}

function getCookieSecret() {
  if (process.env.ADMIN_COOKIE_SECRET) return process.env.ADMIN_COOKIE_SECRET;
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : "dev-secret";
}

function base64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payload: string) {
  const secret = getCookieSecret();
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

  return base64Url(signature);
}

export async function verifyAdminPassword(password: string) {
  const expected = getAdminPassword();
  return Boolean(expected && password === expected);
}

export async function createAdminSessionValue() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expiresAt}`;
  const signature = await signPayload(payload);
  if (!signature) return null;

  return `${payload}.${signature}`;
}

export async function verifyAdminSession(value?: string | null) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [subject, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (subject !== "admin" || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expected = await signPayload(`${subject}.${expiresAtRaw}`);
  return Boolean(expected && expected === signature);
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
