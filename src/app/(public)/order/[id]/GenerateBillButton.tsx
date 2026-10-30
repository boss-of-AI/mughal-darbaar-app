"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GenerateBillButton({
  orderId,
  combinedTotalFormatted,
  orderCount,
  canGenerate,
}: {
  orderId: string;
  combinedTotalFormatted: string;
  orderCount: number;
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateBill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/generate-bill`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not generate bill");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate bill");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(251, 191, 36, 0.10) 0%, rgba(251, 191, 36, 0.16) 100%)",
        border: "2px solid #F59E0B",
        marginBottom: "1.5rem",
        boxShadow: "0 6px 20px rgba(245, 158, 11, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontWeight: 800, color: "#FCD34D", fontSize: "1.02rem" }}>
          🪑 Dine-In Table Actions
        </span>
        <span
          style={{
            background: "rgba(251, 191, 36, 0.35)",
            color: "#FCD34D",
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          {orderCount} {orderCount === 1 ? "Order" : "Orders"} in Session · {combinedTotalFormatted}
        </span>
      </div>

      <p style={{ fontSize: "0.86rem", color: "#FCD34D", marginBottom: "1rem", lineHeight: 1.45 }}>
        Want to order more dishes, rotis, or drinks? You can place multiple orders from this table
        — all orders will be combined into one single bill at the end. When you finish dining,
        tap <strong>&ldquo;Generate Final Total Bill&rdquo;</strong> below to pay at the counter.
      </p>

      {error && (
        <p style={{ color: "#DC2626", fontSize: "0.84rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        <Link
          href="/menu"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.8rem 1rem",
            borderRadius: 10,
            background: "var(--color-surface-alt)",
            color: "#FCD34D",
            border: "1.5px solid #D97706",
            fontWeight: 700,
            fontSize: "0.92rem",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          ➕ Order More Items (Same Table Bill)
        </Link>

        <button
          type="button"
          onClick={handleGenerateBill}
          disabled={loading || !canGenerate}
          style={{
            width: "100%",
            padding: "0.95rem 1.25rem",
            borderRadius: 10,
            border: "none",
            background: canGenerate ? "#FBBF24" : "#9CA3AF",
            color: "#FFFFFF",
            fontWeight: 800,
            fontSize: "1rem",
            cursor: loading || !canGenerate ? "not-allowed" : "pointer",
            boxShadow: canGenerate ? "0 4px 12px rgba(180, 83, 9, 0.28)" : "none",
          }}
        >
          {loading
            ? "Generating Final Table Bill…"
            : `🧾 Finished Dining? Generate Final Total Bill (${combinedTotalFormatted})`}
        </button>

        {!canGenerate && (
          <span style={{ fontSize: "0.76rem", color: "#FCD34D", textAlign: "center" }}>
            ⏳ The &ldquo;Generate Final Total Bill&rdquo; button activates as soon as staff accepts your order.
          </span>
        )}
      </div>
    </div>
  );
}
