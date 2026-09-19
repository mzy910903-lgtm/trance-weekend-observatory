import { NextResponse } from "next/server";
import { ACCESS_GATE_COOKIE_NAME } from "@/lib/access-gate";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/access", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(ACCESS_GATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
