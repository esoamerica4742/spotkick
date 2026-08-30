import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const nextPath = new URL(request.url).searchParams.get("next") ?? "/home";
  return NextResponse.redirect(new URL(nextPath, origin));
}
