import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSessionValue,
  verifyAdminPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") || "/admin");

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=1&next=${encodeURIComponent(next)}`, request.url),
      303,
    );
  }

  const sessionValue = await createAdminSessionValue();
  if (!sessionValue) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=1&next=${encodeURIComponent(next)}`, request.url),
      303,
    );
  }

  const target = next.startsWith("/admin") ? next : "/admin";
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, {
    ...adminCookieOptions,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
