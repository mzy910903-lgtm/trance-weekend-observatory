import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const MEMBER_COOKIE = "tw_member_session";
export const WECHAT_STATE_COOKIE = "tw_wechat_state";
const SESSION_DAYS = 30;

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashInviteCode(value: string) {
  return hashValue(normalizeInviteCode(value));
}

export function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `TW-${body.slice(0, 4)}-${body.slice(4)}`;
}

function sessionSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "local-member-session-secret";
  throw new Error("USER_SESSION_SECRET is not configured");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export type WechatState = {
  nonce: string;
  inviteHash?: string;
  next: string;
  expiresAt: number;
};

export function createWechatState(inviteCode: string | undefined, next: string) {
  const payload: WechatState = {
    nonce: randomBytes(18).toString("base64url"),
    inviteHash: inviteCode ? hashInviteCode(inviteCode) : undefined,
    next: safeReturnPath(next, "/me"),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    payload,
    state: `${payload.nonce}.${sign(payload.nonce)}`,
    cookieValue: `${encoded}.${sign(encoded)}`,
  };
}

function signaturesMatch(value: string, signature: string) {
  const expected = sign(value);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function verifyWechatState(state: string, cookieValue: string | undefined) {
  const [stateNonce, stateSignature] = state.split(".");
  const [encoded, cookieSignature] = cookieValue?.split(".") ?? [];
  if (!stateNonce || !stateSignature || !encoded || !cookieSignature) return null;
  if (
    !signaturesMatch(stateNonce, stateSignature) ||
    !signaturesMatch(encoded, cookieSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as WechatState;
    if (
      !payload.nonce ||
      payload.nonce !== stateNonce ||
      payload.expiresAt < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function memberCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createMemberSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: { userId, tokenHash: hashValue(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function getMemberSession() {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.userSession.findFirst({
    where: { tokenHash: hashValue(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  return session;
}

export async function getCurrentMember() {
  return (await getMemberSession())?.user ?? null;
}

export async function recordMemberActivity(userId: string) {
  const activityDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await prisma.userActivityDay.upsert({
    where: { userId_activityDate: { userId, activityDate } },
    update: {},
    create: { userId, activityDate },
  });
}

export function safeReturnPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");
    if (!host || originUrl.host !== host) return false;
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");
    return originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
