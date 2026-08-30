import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/lobby") ||
    path.startsWith("/home") ||
    path.startsWith("/matches") ||
    path.startsWith("/wallet") ||
    path.startsWith("/profile") ||
    path.startsWith("/match/");
  const isAuthPage = path === "/";

  if (!session && isProtected && path !== "/match/practice") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (session && isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/home";
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
