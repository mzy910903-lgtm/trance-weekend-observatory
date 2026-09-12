import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMemberSession,
  hashInviteCode,
  hashPassword,
  isSameOrigin,
  MEMBER_COOKIE,
  memberCookieOptions,
  normalizeInviteCode,
  normalizeLoginName,
  safeReturnPath,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z
  .object({
    inviteCode: z.string().min(1),
    loginName: z.string().trim().min(2).max(30),
    nickname: z.string().trim().min(1).max(30),
    password: z.string().min(8).max(72),
    confirmPassword: z.string(),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

function registerError(request: Request, error: string, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("mode", "register");
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData();
  const next = safeReturnPath(String(form.get("next") ?? "/me"), "/me");
  const parsed = registerSchema.safeParse({
    inviteCode: form.get("inviteCode"),
    loginName: form.get("loginName"),
    nickname: form.get("nickname"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
    next,
  });
  if (!parsed.success) return registerError(request, "register_invalid", next);

  const loginName = normalizeLoginName(parsed.data.loginName);
  if (!/^[\p{L}\p{N}_.-]+$/u.test(loginName)) {
    return registerError(request, "login_name_invalid", next);
  }
  if (await prisma.user.findUnique({ where: { loginName } })) {
    return registerError(request, "login_name_taken", next);
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({
        where: {
          codeHash: hashInviteCode(normalizeInviteCode(parsed.data.inviteCode)),
        },
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
          loginName,
          nickname: parsed.data.nickname,
          passwordHash,
        },
      });
      await tx.inviteRedemption.create({
        data: { inviteCodeId: invite.id, userId: created.id },
      });
      return created;
    });
    const session = await createMemberSession(user.id);
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    response.cookies.set(MEMBER_COOKIE, session.token, memberCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return registerError(
      request,
      error instanceof Error && error.message === "INVITE_INVALID"
        ? "invite_invalid"
        : "register_failed",
      next,
    );
  }
}
