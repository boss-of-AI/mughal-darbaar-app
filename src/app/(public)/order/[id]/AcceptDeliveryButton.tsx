"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptDeliveryButton({
  orderId,
  isCod,
  amountFormatted,
}: {
  orderId: string;
  isCod: boolean;
  amountFormatted: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/deliver`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update order status. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: 14,
        background: "rgba(52, 211, 153, 0.10)",
        border: "2px solid #10B981",
        marginBottom: "1.5rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontWeight: 700, color: "#6EE7B7", fontSize: "1rem", marginBottom: "0.35rem" }}>
        🛵 Has your order reached you?
      </p>
      <p style={{ color: "#34D399", fontSize: "0.875rem", marginBottom: "1rem" }}>
        {isCod
          ? `Please pay ${amountFormatted} in cash to the delivery partner, then click "Accept Order" below to mark it as delivered.`
          : `Click "Accept Order" below once you receive your food to mark it as delivered.`}
      </p>
      {error && (
        <p style={{ color: "#DC2626", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{error}</p>
      )}
      <button
        type="button"
        onClick={handleAccept}
        disabled={busy}
        style={{
          background: "#059669",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 10,
          padding: "0.85rem 1.75rem",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.7 : 1,
          width: "100%",
          boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
        }}
      >
        {busy ? "Updating…" : "✓ Accept Order (Mark as Delivered)"}
      </button>
    </div>
  );
}
