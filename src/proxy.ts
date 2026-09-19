import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth";
import {
  ACCESS_GATE_COOKIE_NAME,
  verifyAccessSession,
} from "@/lib/access-gate";

function isPublicAccessPath(pathname: string) {
  return (
    pathname === "/access" ||
    pathname === "/api/access/login" ||
    pathname === "/api/access/logout" ||
    pathname === "/api/dashboard/summary" ||
    pathname.startsWith("/api/cron/")
  );
}

function isPublicAdminPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPublicAccessPath(pathname)) {
    const hasLabAccess = await verifyAccessSession(
      request.cookies.get(ACCESS_GATE_COOKIE_NAME)?.value,
    );

    if (!hasLabAccess) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Access required" }, { status: 401 });
      }

      const loginUrl = new URL("/access", request.url);
      loginUrl.searchParams.set(
        "next",
        `${pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdminPath) {
    return NextResponse.next();
  }

  if (isPublicAdminPath(pathname)) {
    return NextResponse.next();
  }

  const isAuthed = await verifyAdminSession(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );

  if (isAuthed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|mp4|webm|wasm|task|txt|xml)$).*)",
  ],
};
