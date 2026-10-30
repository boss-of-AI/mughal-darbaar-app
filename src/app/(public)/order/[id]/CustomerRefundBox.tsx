"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Copy, CheckCircle2, KeyRound, Clock } from "lucide-react";

const rupees = (p: number) =>
  `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CustomerRefundBox({
  orderId,
  orderNumber,
  totalPaise,
  initialToken,
  initialStatus,
  initialNote,
  processedAt,
}: {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  initialToken: string | null;
  initialStatus: string | null;
  initialNote: string | null;
  processedAt: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [status, setStatus] = useState<string>(initialStatus || "none");
  const [note, setNote] = useState<string>(initialNote || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateToken(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate refund token");
        return;
      }
      setToken(data.refundToken);
      setStatus(data.refundStatus || "requested");
      router.refresh();
    } catch {
      setError("Network error while generating refund token.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!token || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (status === "processed") {
    return (
      <section
        style={{
          padding: "1.25rem 1.35rem",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(52, 211, 153, 0.10) 0%, rgba(52, 211, 153, 0.16) 100%)",
          border: "2px solid #10B981",
          color: "#6EE7B7",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
          <CheckCircle2 size={20} style={{ color: "#059669" }} />
          <strong style={{ fontSize: "1.02rem" }}>
            ✅ Online Payment Refund Verified &amp; Processed ({rupees(totalPaise)})
          </strong>
        </div>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
          The restaurant owner verified your refund token{" "}
          {token ? <strong>({token})</strong> : ""} and processed your refund of{" "}
          <strong>{rupees(totalPaise)}</strong> for Order <strong>#{orderNumber}</strong>.
        </p>
        {processedAt && (
          <div style={{ fontSize: "0.76rem", opacity: 0.88 }}>
            Processed on: {new Date(processedAt).toLocaleString("en-IN")}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      style={{
        padding: "1.25rem 1.35rem",
        borderRadius: 16,
        background: "rgba(251, 191, 36, 0.10)",
        border: "2px solid #F59E0B",
        color: "#FCD34D",
        marginBottom: "1.5rem",
        boxShadow: "0 10px 25px rgba(245, 158, 11, 0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
        <ShieldCheck size={20} style={{ color: "#D97706" }} />
        <strong style={{ fontSize: "1.02rem" }}>
          💳 Online Payment Refund Portal ({rupees(totalPaise)})
        </strong>
      </div>

      {!token ? (
        <form onSubmit={handleGenerateToken}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.84rem", lineHeight: 1.45 }}>
            Your online-paid order was not fulfilled. Generate your unique{" "}
            <strong>Refund Verification Token</strong> below so the Restaurant Owner (Admin) can
            verify it and process your refund of <strong>{rupees(totalPaise)}</strong>.
          </p>
          <input
            type="text"
            className="form-input"
            placeholder="Optional note / reason / UPI reference for owner…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={250}
            style={{ marginBottom: "0.65rem", background: "var(--color-surface-alt)" }}
          />
          {error && (
            <p style={{ color: "#DC2626", fontSize: "0.8rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #D97706 0%, #FBBF24 100%)",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.45rem",
            }}
          >
            <KeyRound size={16} />
            {loading
              ? "Generating Verification Token…"
              : `🔐 Generate Refund Verification Token (${rupees(totalPaise)})`}
          </button>
        </form>
      ) : (
        <div>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.84rem", lineHeight: 1.45 }}>
            Your <strong>Refund Verification Token</strong> has been generated and sent to the
            Restaurant Owner. Share this token with the Owner if requested — once verified, your{" "}
            <strong>{rupees(totalPaise)}</strong> refund will be marked processed immediately:
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              padding: "0.85rem 1rem",
              borderRadius: 12,
              background: "var(--color-surface-alt)",
              border: "2px dashed #D97706",
              marginBottom: "0.65rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#FCD34D",
                  fontWeight: 800,
                }}
              >
                Customer Refund Verification Token
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  color: "#FBBF24",
                  fontFamily: "monospace",
                }}
              >
                {token}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 8,
                border: "1px solid #D97706",
                background: copied ? "rgba(52, 211, 153, 0.10)" : "rgba(251, 191, 36, 0.10)",
                color: copied ? "#34D399" : "#FCD34D",
                fontWeight: 800,
                fontSize: "0.78rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <Copy size={14} />
              {copied ? "✓ Token Copied!" : "Copy Token"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#FBBF24",
            }}
          >
            <Clock size={14} /> Status: Awaiting Owner Token Verification &amp; Refund Approval
          </div>
        </div>
      )}
    </section>
  );
}
