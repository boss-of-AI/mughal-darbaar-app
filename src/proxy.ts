import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Dashboard routes require owner, staff, or rider
  if (pathname.startsWith("/dashboard")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    if (!["owner", "staff", "rider"].includes(session.user.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Riders are restricted to the Rider Delivery & Navigation Portal
    if (
      session.user.role === "rider" &&
      !pathname.startsWith("/dashboard/rider")
    ) {
      return NextResponse.redirect(new URL("/dashboard/rider", req.url));
    }
  }

  // Owner-only settings
  if (pathname.startsWith("/dashboard/settings")) {
    if (session?.user?.role !== "owner") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
