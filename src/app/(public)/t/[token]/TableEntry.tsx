"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cartActions } from "@/lib/cart";

export default function TableEntry({ token, tableName }: { token: string; tableName: string }) {
  const router = useRouter();
  useEffect(() => {
    cartActions.setTableToken(token);
    const t = setTimeout(() => router.replace("/menu"), 1200);
    return () => clearTimeout(t);
  }, [token, router]);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: "6rem 1rem" }}>
      <div>
        <p style={{ fontSize: "3rem" }} aria-hidden="true">🪑</p>
        <h1 style={{ fontFamily: "var(--font-heading)" }}>Welcome to {tableName}</h1>
        <p>Opening the menu… You&apos;ll pay at the counter.</p>
      </div>
    </main>
  );
}
