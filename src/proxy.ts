import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Dashboard routes require owner or staff
  if (pathname.startsWith("/dashboard")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    if (!["owner", "staff"].includes(session.user.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Owner-only settings
  if (
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/staff")
  ) {
    if (session?.user?.role !== "owner") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
