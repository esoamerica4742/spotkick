import { NextResponse } from "next/server";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/", new URL(request.url).origin));
}

export function POST(request: Request) {
  return NextResponse.redirect(new URL("/api/auth/signout", request.url), 307);
}
