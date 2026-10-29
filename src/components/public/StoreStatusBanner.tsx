"use client";

import { useState, useEffect } from "react";
import { Clock, XCircle, Calendar } from "lucide-react";
import type { StoreAvailabilityResult } from "@/lib/store-hours";

export default function StoreStatusBanner() {
  const [status, setStatus] = useState<StoreAvailabilityResult | null>(null);
  const [dismissedModal, setDismissedModal] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/store-status", { cache: "no-store" });
        if (res.ok && active) {
          const data: StoreAvailabilityResult = await res.json();
          setStatus(data);
        }
      } catch {
        /* ignore */
      }
    };
    const init = setTimeout(load, 0);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearTimeout(init);
      clearInterval(timer);
    };
  }, []);

  if (!status || status.isOpenNow) return null;

  return (
    <>
      {/* Persistent Top Closed Notice Bar */}
      <div
        role="status"
        style={{
          background: "linear-gradient(90deg, #7F1D1D 0%, #991B1B 50%, #7F1D1D 100%)",
          color: "#FEF2F2",
          padding: "0.6rem 1rem",
          borderBottom: "2px solid #F59E0B",
          fontSize: "0.82rem",
          zIndex: 90,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.18rem 0.55rem",
                borderRadius: 999,
                background: "#FEE2E2",
                color: "#991B1B",
                fontWeight: 800,
                fontSize: "0.72rem",
              }}
            >
              🔴 CLOSED / NOT LIVE
            </span>
            <strong>{status.headline}</strong>
            <span style={{ opacity: 0.92 }}>
              · Order Accepting Timings ({status.todayLabel}):{" "}
              <strong style={{ color: "#FDE68A" }}>{status.todayFormattedWindow}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedModal(false)}
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              border: "1px solid #FDE68A",
              background: "rgba(254, 243, 199, 0.14)",
              color: "#FDE68A",
              fontSize: "0.74rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⏰ View Order Timings
          </button>
        </div>
      </div>

      {/* Full Modal Shown When Customer Opens Website in Closed Time */}
      {!dismissedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Restaurant Closed Notice"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 10, 6, 0.78)",
            backdropFilter: "blur(5px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#1C120C",
              color: "#FDF8F0",
              borderRadius: 20,
              border: "2px solid #D97706",
              boxShadow: "0 25px 60px rgba(0,0,0,0.65)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1.35rem 1.5rem 1.1rem",
                background: "linear-gradient(135deg, #7F1D1D 0%, #450A0A 100%)",
                borderBottom: "1px solid rgba(245, 158, 11, 0.35)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.28rem 0.85rem",
                  borderRadius: 999,
                  background: "#FEE2E2",
                  color: "#991B1B",
                  fontSize: "0.74rem",
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                  marginBottom: "0.65rem",
                }}
              >
                <XCircle size={14} /> RESTAURANT IS CLOSED / NOT LIVE
              </div>
              <h2
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  color: "#FFFBEB",
                }}
              >
                {status.headline}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.84rem",
                  color: "#FDE68A",
                  lineHeight: 1.45,
                }}
              >
                {status.subline}
              </p>
            </div>

            {/* Timings Body */}
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {/* Today's Order Accepting Window Highlight */}
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: 12,
                  background: "rgba(217, 119, 6, 0.14)",
                  border: "1px solid rgba(245, 158, 11, 0.45)",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Clock size={18} style={{ color: "#FBBF24", flexShrink: 0 }} />
                  <div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#FCD34D",
                        fontWeight: 700,
                      }}
                    >
                      Today&apos;s Order Accepting Timings ({status.todayLabel})
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF" }}>
                      {status.todayFormattedWindow}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "#D1D5DB",
                    background: "rgba(255,255,255,0.08)",
                    padding: "0.22rem 0.55rem",
                    borderRadius: 6,
                  }}
                >
                  IST Now: {status.currentIstTimeFormatted}
                </span>
              </div>

              {/* Weekly Schedule Table */}
              <div style={{ marginBottom: "1.1rem" }}>
                <div
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    color: "#FCD34D",
                    marginBottom: "0.45rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <Calendar size={14} /> Weekly Order Accepting Timings (IST)
                </div>
                <div
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    overflow: "hidden",
                    fontSize: "0.78rem",
                  }}
                >
                  {status.schedule.map((row) => (
                    <div
                      key={row.dayKey}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.42rem 0.75rem",
                        background: row.isToday
                          ? "rgba(245, 158, 11, 0.22)"
                          : "rgba(255,255,255,0.03)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        fontWeight: row.isToday ? 800 : 500,
                        color: row.isToday ? "#FDE68A" : "#E5E7EB",
                      }}
                    >
                      <span>
                        {row.dayLabel} {row.isToday ? "(Today)" : ""}
                      </span>
                      <span>{row.formatted}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDismissedModal(true)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid #F59E0B",
                  background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                👀 Browse Menu Only (Ordering Opens at {status.todayFormattedWindow})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
