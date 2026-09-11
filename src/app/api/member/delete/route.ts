import { NextResponse } from "next/server";
import {
  getCurrentMember,
  isSameOrigin,
  MEMBER_COOKIE,
} from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getCurrentMember();
  if (user) await prisma.user.delete({ where: { id: user.id } });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(MEMBER_COOKIE);
  return response;
}
