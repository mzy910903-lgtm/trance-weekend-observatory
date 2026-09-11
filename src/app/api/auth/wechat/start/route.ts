import { NextResponse } from "next/server";
import {
  createWechatState,
  hashInviteCode,
  memberCookieOptions,
  normalizeInviteCode,
  safeReturnPath,
  WECHAT_STATE_COOKIE,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const form = await request.formData();
  const inviteCode = normalizeInviteCode(String(form.get("inviteCode") ?? ""));
  const next = safeReturnPath(String(form.get("next") ?? "/me"), "/me");
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL(`/login?error=not_configured`, request.url));
  }

  if (inviteCode) {
    const invite = await prisma.inviteCode.findUnique({
      where: { codeHash: hashInviteCode(inviteCode) },
    });
    if (
      !invite ||
      !invite.enabled ||
      invite.usedCount >= invite.maxUses ||
      (invite.expiresAt && invite.expiresAt <= new Date())
    ) {
      return NextResponse.redirect(new URL(`/login?error=invite_invalid`, request.url));
    }
  }

  const { payload, state, cookieValue } = createWechatState(
    inviteCode || undefined,
    next,
  );
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const callback = `${siteUrl.replace(/\/$/, "")}/api/auth/wechat/callback`;
  const authorizeUrl = new URL("https://open.weixin.qq.com/connect/oauth2/authorize");
  authorizeUrl.searchParams.set("appid", appId);
  authorizeUrl.searchParams.set("redirect_uri", callback);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "snsapi_userinfo");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(`${authorizeUrl.toString()}#wechat_redirect`);
  response.cookies.set(
    WECHAT_STATE_COOKIE,
    cookieValue,
    memberCookieOptions(new Date(payload.expiresAt)),
  );
  return response;
}
