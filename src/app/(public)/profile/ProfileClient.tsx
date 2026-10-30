"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Clock,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  Search,
  Navigation,
} from "lucide-react";
import { useCart } from "@/lib/cart";

interface HistoryItem {
  id: string;
  menuItemId: string | null;
  name: string;
  variantId: string | null;
  variantName: string | null;
  unitPricePaise: number;
  quantity: number;
  totalPaise: number;
}

interface HistoryOrder {
  id: string;
  orderNumber: string;
  serviceMode: "delivery" | "pickup" | "dine_in";
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  createdAt: string;
  tableName: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderReachedAt: string | null;
  refundToken?: string | null;
  refundStatus?: string | null;
  refundProcessedAt?: string | null;
  items: HistoryItem[];
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ProfileClient() {
  const router = useRouter();
  const { add, tableToken, setTableToken } = useCart();

  const [profile, setProfile] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("md_guest_info");
        if (raw) {
          const g = JSON.parse(raw);
          return {
            name: g.name || "",
            phone: g.phone || "",
            email: g.email || "",
            line1: g.line1 || "",
            city: g.city || "Mumbai",
            pincode: g.pincode || "",
          };
        }
      } catch {
        /* ignore */
      }
    }
    return {
      name: "",
      phone: "",
      email: "",
      line1: "",
      city: "Mumbai",
      pincode: "",
    };
  });

  const [savedNotice, setSavedNotice] = useState(false);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async (phoneToQuery: string) => {
    let savedIds: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("md_order_ids");
        if (raw) savedIds = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }

    const cleanPhone = phoneToQuery.replace(/\D/g, "");
    if (cleanPhone.length < 10 && savedIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const qs = new URLSearchParams();
      if (cleanPhone.length >= 10) qs.set("phone", cleanPhone);
      if (savedIds.length > 0) qs.set("ids", savedIds.join(","));

      const res = await fetch(`/api/orders/history?${qs.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      fetchOrders(profile.phone);
    }, 0);
    const timer = setInterval(() => {
      fetchOrders(profile.phone);
    }, 6000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [fetchOrders, profile.phone]);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      window.localStorage.setItem("md_guest_info", JSON.stringify(profile));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      /* ignore */
    }
    setLoading(true);
    fetchOrders(profile.phone);
  }

  function handleReorder(order: HistoryOrder) {
    order.items.forEach((item) => {
      for (let q = 0; q < item.quantity; q++) {
        add({
          itemId: item.menuItemId || item.id,
          name: item.name,
          isVegetarian: false,
          variantId: item.variantId,
          variantName: item.variantName,
          unitPricePaise: item.unitPricePaise,
        });
      }
    });
    router.push("/checkout");
  }

  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled", "rejected"].includes(o.status)
  );
  const pastOrders = orders.filter((o) =>
    ["delivered", "cancelled", "rejected"].includes(o.status)
  );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "6.5rem 1rem 4rem" }}>
      {/* Top Header + Mode Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-3xl)",
              margin: 0,
            }}
          >
            My Profile &amp; Order History
          </h1>
          <p style={{ color: "var(--color-text-muted)", margin: "0.3rem 0 0" }}>
            Manage your saved details, track live orders, and reorder your favourite dishes.
          </p>
        </div>

        {/* Dine-In vs Online Mode Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-border)",
            borderRadius: 999,
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setTableToken(null)}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              background: !tableToken ? "var(--color-primary)" : "transparent",
              color: !tableToken ? "#fff" : "var(--color-text-muted)",
            }}
          >
            🛵 Order Online
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/api/tables");
                const data = await res.json();
                const firstToken = data.tables?.[0]?.qrToken || "dine-in-table-1-token";
                setTableToken(firstToken);
              } catch {
                setTableToken("dine-in-table-1-token");
              }
            }}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              background: tableToken ? "var(--color-primary)" : "transparent",
              color: tableToken ? "#fff" : "var(--color-text-muted)",
            }}
          >
            🪑 Dine-In Mode
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left: Customer Profile Card */}
        <form
          onSubmit={handleSaveProfile}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 16,
            padding: "1.4rem",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "1.1rem",
              fontWeight: 800,
              marginBottom: "1rem",
            }}
          >
            <User size={18} /> Customer Details
          </h2>

          <label className="form-label" htmlFor="pf-name">
            Full Name
          </label>
          <input
            id="pf-name"
            className="form-input"
            placeholder="Your full name"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
          />

          <label className="form-label" htmlFor="pf-phone">
            10-Digit Mobile Number (Used to look up your orders) *
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="pf-phone"
              className="form-input"
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <label className="form-label" htmlFor="pf-email">
            Email (Optional)
          </label>
          <input
            id="pf-email"
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={profile.email}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
          />

          <label className="form-label" htmlFor="pf-addr">
            Default Delivery Address
          </label>
          <input
            id="pf-addr"
            className="form-input"
            placeholder="Flat / building / street"
            value={profile.line1}
            onChange={(e) => setProfile((p) => ({ ...p, line1: e.target.value }))}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              aria-label="City"
              className="form-input"
              placeholder="City"
              value={profile.city}
              onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            />
            <input
              aria-label="Pincode"
              className="form-input"
              placeholder="Pincode"
              maxLength={6}
              value={profile.pincode}
              onChange={(e) => setProfile((p) => ({ ...p, pincode: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            style={{ marginTop: "1rem" }}
          >
            <Search size={15} /> Save Profile &amp; Sync Order History
          </button>

          {savedNotice && (
            <p
              style={{
                color: "#059669",
                fontSize: "0.82rem",
                fontWeight: 700,
                marginTop: "0.6rem",
                textAlign: "center",
              }}
            >
              ✓ Profile saved and order history synced!
            </p>
          )}
        </form>

        {/* Right: Active Orders + Past Order History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Active Orders */}
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 16,
              padding: "1.4rem",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "1.1rem",
                fontWeight: 800,
                marginBottom: "1rem",
              }}
            >
              <Clock size={18} color="#D97706" /> Active / Live Orders ({activeOrders.length})
            </h2>

            {loading ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                Loading your orders…
              </p>
            ) : activeOrders.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem" }}>
                No active orders right now.{" "}
                <Link href="/menu" style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                  Explore our menu →
                </Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {activeOrders.map((order) => {
                  const isPaid = order.paymentStatus === "paid";
                  const isCod =
                    order.paymentMethod === "cash_on_delivery" ||
                    order.paymentMethod === "pay_at_counter";

                  return (
                    <div
                      key={order.id}
                      style={{
                        border: order.riderReachedAt
                          ? "2px solid #059669"
                          : "1.5px solid #F59E0B",
                        borderRadius: 12,
                        padding: "1rem",
                        background: order.riderReachedAt ? "rgba(52, 211, 153, 0.10)" : "rgba(251, 191, 36, 0.10)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div>
                          <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>
                            #{order.orderNumber}
                          </strong>
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(251, 191, 36, 0.35)",
                              color: "#FCD34D",
                              textTransform: "capitalize",
                            }}
                          >
                            {order.serviceMode === "dine_in"
                              ? `🪑 ${order.tableName || "Dine-In"}`
                              : `🛵 ${order.serviceMode}`}
                          </span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: "1rem" }}>
                          {rupees(order.totalPaise)}
                        </span>
                      </div>

                      {/* Rider Reached Alert */}
                      {order.riderReachedAt && (
                        <div
                          style={{
                            padding: "0.65rem 0.85rem",
                            borderRadius: 8,
                            background: "#059669",
                            color: "#fff",
                            fontSize: "0.84rem",
                            fontWeight: 800,
                            marginBottom: "0.65rem",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Navigation size={15} />
                          <span>
                            📍 Your Rider ({order.riderName || "Delivery Partner"}) has REACHED your
                            location!
                            {!isPaid && isCod
                              ? ` Please keep ${rupees(order.totalPaise)} cash ready.`
                              : ""}
                          </span>
                        </div>
                      )}

                      {order.riderName && !order.riderReachedAt && (
                        <p
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "#67E8F9",
                            marginBottom: "0.5rem",
                          }}
                        >
                          🛵 Assigned Rider: {order.riderName}
                          {order.riderPhone ? ` (📞 ${order.riderPhone})` : ""}
                        </p>
                      )}

                      <div style={{ fontSize: "0.84rem", marginBottom: "0.65rem" }}>
                        {order.items.map((i) => (
                          <div key={i.id}>
                            <strong>{i.quantity}×</strong> {i.name}
                            {i.variantName ? ` (${i.variantName})` : ""} — {rupees(i.totalPaise)}
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          paddingTop: "0.5rem",
                          borderTop: "1px dashed rgba(0,0,0,0.15)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: isPaid ? "#34D399" : "#FBBF24",
                          }}
                        >
                          {isPaid
                            ? "✅ PAID"
                            : `💵 To Pay: ${rupees(order.totalPaise)} (${
                                order.serviceMode === "dine_in" ? "Counter" : "COD"
                              })`}
                        </span>

                        <Link
                          href={`/order/${order.id}`}
                          className="btn btn--primary btn--sm"
                          style={{ textDecoration: "none" }}
                        >
                          Track Live Order <ExternalLink size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past Order History */}
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 16,
              padding: "1.4rem",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "1.1rem",
                fontWeight: 800,
                marginBottom: "1rem",
              }}
            >
              <CheckCircle size={18} color="#059669" /> Past Order History ({pastOrders.length})
            </h2>

            {pastOrders.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem" }}>
                Enter your 10-digit mobile number on the left to view all your past orders.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {pastOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      padding: "1rem",
                      background: "var(--color-surface-alt)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "0.4rem",
                      }}
                    >
                      <div>
                        <strong style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                          #{order.orderNumber}
                        </strong>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: order.status === "delivered" ? "rgba(52, 211, 153, 0.16)" : "rgba(248, 113, 113, 0.16)",
                          color: order.status === "delivered" ? "#34D399" : "#F87171",
                          textTransform: "uppercase",
                        }}
                      >
                        {order.status === "delivered" && order.serviceMode === "dine_in"
                          ? "Paid at Counter"
                          : order.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.84rem", margin: "0.5rem 0" }}>
                      {order.items.map((i) => (
                        <div key={i.id}>
                          <strong>{i.quantity}×</strong> {i.name}
                          {i.variantName ? ` (${i.variantName})` : ""}
                        </div>
                      ))}
                    </div>

                    {/* Refund Token Status / Generator for Rejected Paid Orders */}
                    {(order.status === "rejected" || order.status === "cancelled") &&
                      (order.paymentStatus === "paid" ||
                        order.paymentStatus === "refunded") && (
                        <div
                          style={{
                            margin: "0.6rem 0",
                            padding: "0.65rem 0.85rem",
                            borderRadius: 10,
                            background:
                              order.paymentStatus === "refunded" ||
                              order.refundStatus === "processed"
                                ? "rgba(52, 211, 153, 0.10)"
                                : "rgba(251, 191, 36, 0.10)",
                            border:
                              order.paymentStatus === "refunded" ||
                              order.refundStatus === "processed"
                                ? "1.5px solid #10B981"
                                : "1.5px solid #F59E0B",
                            fontSize: "0.8rem",
                          }}
                        >
                          {order.paymentStatus === "refunded" ||
                          order.refundStatus === "processed" ? (
                            <div style={{ color: "#6EE7B7", fontWeight: 700 }}>
                              ✅ Online Payment Refund Processed ({rupees(order.totalPaise)})
                              {order.refundToken ? ` · Token: ${order.refundToken}` : ""}
                            </div>
                          ) : order.refundToken ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                                color: "#FCD34D",
                              }}
                            >
                              <span>
                                🔐 <strong>Refund Token:</strong>{" "}
                                <code
                                  style={{
                                    fontSize: "0.95rem",
                                    fontWeight: 900,
                                    color: "#FBBF24",
                                  }}
                                >
                                  {order.refundToken}
                                </code>{" "}
                                (Awaiting Owner Verification)
                              </span>
                              <Link
                                href={`/order/${order.id}`}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  color: "#FBBF24",
                                }}
                              >
                                View Refund Portal →
                              </Link>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                                color: "#FCD34D",
                              }}
                            >
                              <span>
                                💳 Online-paid order rejected — eligible for{" "}
                                <strong>{rupees(order.totalPaise)}</strong> refund
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch(`/api/orders/${order.id}/refund-request`, {
                                    method: "POST",
                                  });
                                  fetchOrders(profile.phone);
                                }}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "#D97706",
                                  color: "#FFFFFF",
                                  fontWeight: 800,
                                  fontSize: "0.76rem",
                                  cursor: "pointer",
                                }}
                              >
                                🔐 Generate Refund Token
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        paddingTop: "0.5rem",
                        borderTop: "1px solid var(--color-border)",
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                        Total: {rupees(order.totalPaise)}
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link
                          href={`/order/${order.id}`}
                          className="btn btn--secondary btn--sm"
                          style={{ textDecoration: "none" }}
                        >
                          Receipt
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleReorder(order)}
                          className="btn btn--primary btn--sm"
                        >
                          <RotateCcw size={13} /> Reorder
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
