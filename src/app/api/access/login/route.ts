import { NextResponse } from "next/server";
import {
  ACCESS_GATE_COOKIE_NAME,
  accessGateCookieOptions,
  createAccessSessionValue,
  isAccessGateConfigured,
  verifyAccessPassword,
} from "@/lib/access-gate";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/api/access") ||
    next.length > 2_048
  ) {
    return "/";
  }
  return next;
}

function loginRedirect(request: Request, error: "invalid" | "config", next: string) {
  const url = new URL("/access", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(form.get("next"));

  if (!isAccessGateConfigured()) {
    return loginRedirect(request, "config", next);
  }

  if (!(await verifyAccessPassword(password))) {
    return loginRedirect(request, "invalid", next);
  }

  const sessionValue = await createAccessSessionValue();
  if (!sessionValue) {
    return loginRedirect(request, "config", next);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(ACCESS_GATE_COOKIE_NAME, sessionValue, {
    ...accessGateCookieOptions,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
