"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Gift, X, Check, Sparkles } from "lucide-react";

export interface PublicOffer {
  id: string;
  title: string;
  code: string;
  discountPct: number;
  categoryId: string | null;
  categoryName: string | null;
}

const SEEN_KEY = "md_seen_offer_ids_v1";
export const ACTIVE_COUPON_KEY = "md_active_coupon";

export default function OffersPopup() {
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [open, setOpen] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(ACTIVE_COUPON_KEY);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;

    async function fetchOffers() {
      try {
        const res = await fetch("/api/offers", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: PublicOffer[] = Array.isArray(data.offers) ? data.offers : [];
        if (!mounted) return;
        setOffers(list);

        if (list.length > 0) {
          let seenIds: string[] = [];
          try {
            const raw = window.sessionStorage.getItem(SEEN_KEY);
            if (raw) seenIds = JSON.parse(raw);
          } catch {
            /* ignore */
          }
          const hasUnseen = list.some((o) => !seenIds.includes(o.id));
          if (hasUnseen) {
            setOpen(true);
            try {
              window.sessionStorage.setItem(
                SEEN_KEY,
                JSON.stringify(list.map((o) => o.id))
              );
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore network errors */
      }
    }

    fetchOffers();
    const timer = setInterval(fetchOffers, 15_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  function applyOffer(offer: PublicOffer) {
    setAppliedCode(offer.code);
    try {
      window.localStorage.setItem(ACTIVE_COUPON_KEY, offer.code);
      window.dispatchEvent(new CustomEvent("md_coupon_applied", { detail: offer.code }));
    } catch {
      /* ignore */
    }
  }

  if (offers.length === 0) return null;

  return (
    <>
      {/* Floating Offers Pill (bottom-left) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: "1.25rem",
          left: "1.25rem",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "linear-gradient(135deg, #8B1A1A 0%, #C41E3A 100%)",
          color: "#FFF",
          border: "2px solid #D4AF37",
          borderRadius: "999px",
          padding: "0.65rem 1.1rem",
          fontWeight: 700,
          fontSize: "0.85rem",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(139, 26, 26, 0.35)",
        }}
        aria-label="View Special Offers"
      >
        <Gift size={16} />
        <span>
          {appliedCode
            ? `Coupon ${appliedCode} Applied`
            : `${offers.length} Special Offer${offers.length > 1 ? "s" : ""}!`}
        </span>
      </button>

      {/* Modal Popup */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Special Offers & Coupons"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              background: "#FFFDF9",
              border: "2px solid #D4AF37",
              borderRadius: "20px",
              maxWidth: "480px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #8B1A1A 0%, #C41E3A 100%)",
                color: "#FFF",
                padding: "1.25rem 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Sparkles size={22} color="#FDE047" />
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#FFF" }}>
                    Today&apos;s Special Offers!
                  </h2>
                  <p style={{ fontSize: "0.78rem", margin: 0, opacity: 0.9 }}>
                    Tap any coupon below to apply it to your order
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close offers popup"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "none",
                  color: "#FFF",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Offer Cards */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                maxHeight: "65vh",
                overflowY: "auto",
              }}
            >
              {offers.map((o) => {
                const isApplied = appliedCode === o.code;
                return (
                  <div
                    key={o.id}
                    style={{
                      border: isApplied ? "2px solid #059669" : "1.5px dashed #D4AF37",
                      background: isApplied ? "#ECFDF5" : "#FFF9EB",
                      borderRadius: "14px",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          background: "#8B1A1A",
                          color: "#FFF",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontFamily: "monospace",
                          letterSpacing: "0.05em",
                        }}
                      >
                        CODE: {o.code}
                      </span>
                      <span
                        style={{
                          background: "#FEF08A",
                          color: "#854D0E",
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          padding: "3px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        {o.discountPct}% OFF · {o.categoryName || "All Items"}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontWeight: 700, color: "#1F2937", fontSize: "0.95rem" }}>
                      {o.title}
                    </p>

                    <button
                      type="button"
                      onClick={() => applyOffer(o)}
                      style={{
                        marginTop: "0.25rem",
                        background: isApplied ? "#059669" : "#8B1A1A",
                        color: "#FFF",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.55rem 1rem",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      {isApplied ? (
                        <>
                          <Check size={15} /> Applied ({o.code})
                        </>
                      ) : (
                        `Apply Coupon ${o.code}`
                      )}
                    </button>
                  </div>
                );
              })}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <Link
                  href="/menu"
                  onClick={() => setOpen(false)}
                  className="btn btn--primary btn--full"
                  style={{ textAlign: "center" }}
                >
                  Browse Menu &amp; Order
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
