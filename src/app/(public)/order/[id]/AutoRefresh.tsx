"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server component every 3s so status updates appear in near real-time for customers. */
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
