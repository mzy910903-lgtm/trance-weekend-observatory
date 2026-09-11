import { NextResponse } from "next/server";
import {
  getMemberSession,
  isSameOrigin,
  MEMBER_COOKIE,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const session = await getMemberSession();
  if (session) await prisma.userSession.delete({ where: { id: session.id } });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(MEMBER_COOKIE);
  return response;
}
