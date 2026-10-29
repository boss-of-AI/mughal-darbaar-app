import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Dashboard routes require owner, staff, chef, or rider
  if (pathname.startsWith("/dashboard")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    if (!["owner", "staff", "chef", "rider"].includes(session.user.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Riders are restricted to the Rider Delivery & Navigation Portal
    if (
      session.user.role === "rider" &&
      !pathname.startsWith("/dashboard/rider")
    ) {
      return NextResponse.redirect(new URL("/dashboard/rider", req.url));
    }
    // Chefs are routed to Kitchen Live Orders (/dashboard/orders) & Menu Stock (/dashboard/menu)
    if (
      session.user.role === "chef" &&
      !pathname.startsWith("/dashboard/orders") &&
      !pathname.startsWith("/dashboard/menu")
    ) {
      return NextResponse.redirect(new URL("/dashboard/orders", req.url));
    }
  }

  // Owner-only management pages (Settings, Staff/Role creation, Financial Reports)
  if (
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/staff") ||
    pathname.startsWith("/dashboard/reports")
  ) {
    if (session?.user?.role !== "owner") {
      return NextResponse.redirect(new URL("/dashboard/orders", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
