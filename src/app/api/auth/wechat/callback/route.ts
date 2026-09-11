import { NextResponse } from "next/server";
import {
  createMemberSession,
  MEMBER_COOKIE,
  memberCookieOptions,
  verifyWechatState,
  WECHAT_STATE_COOKIE,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

type TokenPayload = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
};

type ProfilePayload = {
  openid?: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
};

function loginError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateValue = url.searchParams.get("state");
  const stateCookie = request.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|; )${WECHAT_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !stateValue) return loginError(request, "oauth_cancelled");

  const state = verifyWechatState(stateValue, stateCookie);
  if (!state) return loginError(request, "state_invalid");

  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) return loginError(request, "not_configured");

  try {
    const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
    tokenUrl.searchParams.set("appid", appId);
    tokenUrl.searchParams.set("secret", appSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    const token = (await fetch(tokenUrl, { cache: "no-store" }).then((res) =>
      res.json(),
    )) as TokenPayload;
    if (!token.access_token || !token.openid || token.errcode) {
      return loginError(request, "oauth_failed");
    }

    const profileUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
    profileUrl.searchParams.set("access_token", token.access_token);
    profileUrl.searchParams.set("openid", token.openid);
    profileUrl.searchParams.set("lang", "zh_CN");
    const profile = (await fetch(profileUrl, { cache: "no-store" }).then((res) =>
      res.json(),
    )) as ProfilePayload;
    if (!profile.openid || profile.errcode) return loginError(request, "oauth_failed");

    const unionId = profile.unionid ?? token.unionid ?? null;
    let user = unionId
      ? await prisma.user.findFirst({
          where: { OR: [{ unionId }, { wechatOpenId: profile.openid }] },
        })
      : await prisma.user.findUnique({ where: { wechatOpenId: profile.openid } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          unionId: unionId ?? user.unionId,
          nickname: profile.nickname || user.nickname,
          avatarUrl: profile.headimgurl || user.avatarUrl,
          lastLoginAt: new Date(),
        },
      });
    } else {
      if (!state.inviteHash) return loginError(request, "invite_required");
      user = await prisma.$transaction(async (tx) => {
        const invite = await tx.inviteCode.findUnique({
          where: { codeHash: state.inviteHash },
        });
        if (
          !invite ||
          !invite.enabled ||
          invite.usedCount >= invite.maxUses ||
          (invite.expiresAt && invite.expiresAt <= new Date())
        ) {
          throw new Error("INVITE_INVALID");
        }
        const consumed = await tx.inviteCode.updateMany({
          where: { id: invite.id, enabled: true, usedCount: { lt: invite.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (consumed.count !== 1) throw new Error("INVITE_INVALID");
        const created = await tx.user.create({
          data: {
            wechatOpenId: profile.openid!,
            unionId,
            nickname: profile.nickname || "传思听众",
            avatarUrl: profile.headimgurl || null,
          },
        });
        await tx.inviteRedemption.create({
          data: { inviteCodeId: invite.id, userId: created.id },
        });
        return created;
      });
    }

    const session = await createMemberSession(user.id);
    const response = NextResponse.redirect(new URL(state.next, request.url));
    response.cookies.set(MEMBER_COOKIE, session.token, memberCookieOptions(session.expiresAt));
    response.cookies.delete(WECHAT_STATE_COOKIE);
    return response;
  } catch (error) {
    return loginError(
      request,
      error instanceof Error && error.message === "INVITE_INVALID"
        ? "invite_invalid"
        : "oauth_failed",
    );
  }
}
