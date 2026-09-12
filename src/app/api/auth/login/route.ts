import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMemberSession,
  isSameOrigin,
  MEMBER_COOKIE,
  memberCookieOptions,
  normalizeLoginName,
  safeReturnPath,
  verifyPassword,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  loginName: z.string().trim().min(2).max(30),
  password: z.string().min(8).max(72),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData();
  const next = safeReturnPath(String(form.get("next") ?? "/me"), "/me");
  const parsed = loginSchema.safeParse({
    loginName: form.get("loginName"),
    password: form.get("password"),
    next,
  });
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/login?error=login_failed&next=${encodeURIComponent(next)}`, request.url),
      303,
    );
  }

  const user = await prisma.user.findUnique({
    where: { loginName: normalizeLoginName(parsed.data.loginName) },
  });
  const valid = Boolean(
    user?.passwordHash && (await verifyPassword(parsed.data.password, user.passwordHash)),
  );
  if (!user || !valid) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.redirect(
      new URL(`/login?error=login_failed&next=${encodeURIComponent(next)}`, request.url),
      303,
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createMemberSession(user.id);
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(MEMBER_COOKIE, session.token, memberCookieOptions(session.expiresAt));
  return response;
}
