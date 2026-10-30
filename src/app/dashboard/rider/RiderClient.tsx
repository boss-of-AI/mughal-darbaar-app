"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Navigation,
  Phone,
  MapPin,
  Banknote,
  CheckCircle,
  Volume2,
  VolumeX,
  Map as MapIcon,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { DashboardOrderPayload } from "@/lib/sse";

const paise2rupee = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

function playRiderChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [587.33, 880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.14 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.45);
    });
  } catch {
    /* ignore */
  }
}

export default function RiderClient({
  initialOrders,
  currentUserId,
  currentUserRole,
  currentUserName,
  riders,
}: {
  initialOrders: DashboardOrderPayload[];
  currentUserId: string | null;
  currentUserRole: string;
  currentUserName: string;
  riders: { id: string; name: string; phone: string | null }[];
}) {
  const [orders, setOrders] = useState<DashboardOrderPayload[]>(initialOrders);
  const [selectedRiderFilter, setSelectedRiderFilter] = useState<string>(
    currentUserRole === "rider" && currentUserId ? currentUserId : "all"
  );
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMaps, setOpenMaps] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundRef = useRef(soundEnabled);

  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const es = new EventSource("/api/dashboard/orders/stream");

    es.addEventListener("connected", () => setConnected(true));

    const upsertOrder = (incoming: DashboardOrderPayload, shouldChime = false) => {
      if (incoming.orderType !== "delivery") return;
      setOrders((prev) =>
        prev.some((o) => o.id === incoming.id)
          ? prev.map((o) => (o.id === incoming.id ? incoming : o))
          : [incoming, ...prev]
      );
      if (shouldChime && soundRef.current) {
        if (
          currentUserRole !== "rider" ||
          !currentUserId ||
          incoming.riderId === currentUserId
        ) {
          playRiderChime();
        }
      }
    };

    es.addEventListener("new_order", (e) => {
      upsertOrder(JSON.parse(e.data), false);
    });

    es.addEventListener("order_updated", (e) => {
      upsertOrder(JSON.parse(e.data), false);
    });

    es.addEventListener("rider_assigned", (e) => {
      upsertOrder(JSON.parse(e.data), true);
    });

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [currentUserId, currentUserRole]);

  const handleRiderAction = useCallback(
    async (orderId: string, action: "reached" | "cash_collected" | "delivered") => {
      setBusyId(orderId);
      try {
        const res = await fetch(`/api/orders/${orderId}/rider-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          const updated: DashboardOrderPayload = await res.json();
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  // Filter orders for this rider (or selected rider if owner/staff)
  const riderScopedOrders = orders.filter((o) => {
    if (o.orderType !== "delivery") return false;
    if (currentUserRole === "rider" && currentUserId) {
      return o.riderId === currentUserId;
    }
    if (selectedRiderFilter !== "all") {
      return o.riderId === selectedRiderFilter;
    }
    return Boolean(o.riderId) || o.status === "out_for_delivery";
  });

  const activeDeliveries = riderScopedOrders.filter(
    (o) => !["delivered", "cancelled", "rejected"].includes(o.status)
  );
  const completedDeliveries = riderScopedOrders.filter((o) => o.status === "delivered");

  const totalCashToCollectPaise = activeDeliveries.reduce((sum, o) => {
    const isCodUnpaid =
      o.paymentMethod === "cash_on_delivery" && o.paymentStatus !== "paid";
    return isCodUnpaid ? sum + o.totalPaise : sum;
  }, 0);

  const displayedOrders = tab === "active" ? activeDeliveries : completedDeliveries;

  return (
    <div style={{ padding: "1.75rem", maxWidth: 1150, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
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
            🛵 Rider Delivery &amp; Navigation Portal
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#10B981" : "#EF4444",
                display: "inline-block",
              }}
            />
            {connected ? "Live Dispatch Connected" : "Connecting…"} · Logged in as{" "}
            <strong>{currentUserName}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          {currentUserRole !== "rider" && riders.length > 0 && (
            <select
              aria-label="Filter by Rider"
              value={selectedRiderFilter}
              onChange={(e) => setSelectedRiderFilter(e.target.value)}
              className="form-input"
              style={{ width: "auto", padding: "0.45rem 0.85rem", fontSize: "0.84rem" }}
            >
              <option value="all">All Riders ({riders.length})</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  🛵 {r.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playRiderChime();
            }}
            className="btn btn--secondary btn--sm"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? "Sound ON" : "Muted"}
          </button>
        </div>
      </div>

      {/* Summary Banner: Allotted Count + Total COD Cash to Collect */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "1.1rem 1.25rem",
            borderRadius: 14,
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-border)",
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 700 }}>
            ACTIVE ALLOTTED ORDERS
          </span>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.2rem 0 0" }}>
            {activeDeliveries.length}
          </p>
        </div>

        <div
          style={{
            padding: "1.1rem 1.25rem",
            borderRadius: 14,
            background: totalCashToCollectPaise > 0 ? "rgba(251, 191, 36, 0.10)" : "rgba(52, 211, 153, 0.10)",
            border:
              totalCashToCollectPaise > 0
                ? "1.5px solid #F59E0B"
                : "1.5px solid #10B981",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: totalCashToCollectPaise > 0 ? "#FCD34D" : "#6EE7B7",
              fontWeight: 800,
            }}
          >
            💵 TOTAL CASH TO COLLECT (COD)
          </span>
          <p
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              margin: "0.2rem 0 0",
              color: totalCashToCollectPaise > 0 ? "#FBBF24" : "#34D399",
            }}
          >
            {paise2rupee(totalCashToCollectPaise)}
          </p>
        </div>

        <div
          style={{
            padding: "1.1rem 1.25rem",
            borderRadius: 14,
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-border)",
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 700 }}>
            COMPLETED DELIVERIES
          </span>
          <p style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.2rem 0 0", color: "#059669" }}>
            {completedDeliveries.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("active")}
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: 10,
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            background: tab === "active" ? "var(--color-primary)" : "var(--color-surface)",
            color: tab === "active" ? "#fff" : "var(--color-text)",
          }}
        >
          🛵 Active Allotted Orders ({activeDeliveries.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: 10,
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            background: tab === "completed" ? "var(--color-primary)" : "var(--color-surface)",
            color: tab === "completed" ? "#fff" : "var(--color-text)",
          }}
        >
          ✅ Completed ({completedDeliveries.length})
        </button>
      </div>

      {/* Order Cards */}
      {displayedOrders.length === 0 ? (
        <div
          style={{
            padding: "3.5rem 1.5rem",
            textAlign: "center",
            background: "var(--color-surface)",
            borderRadius: 16,
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🛵</div>
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--color-text)" }}>
            {tab === "active"
              ? "No active delivery orders allotted right now"
              : "No completed deliveries yet"}
          </h3>
          <p style={{ fontSize: "0.86rem", margin: 0 }}>
            When Admin or Staff allots a delivery order to you, it will appear here immediately with
            turn-by-turn navigation.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {displayedOrders.map((order) => {
            const addr = order.deliveryAddress;
            const fullAddressString = addr
              ? `${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}${
                  addr.landmark ? `, ${addr.landmark}` : ""
                }, ${addr.city} ${addr.pincode}`
              : "Mumbai";

            const hasGps =
              typeof addr?.lat === "number" && typeof addr?.lng === "number";

            const googleMapsNavUrl = hasGps
              ? `https://www.google.com/maps/dir/?api=1&destination=${addr!.lat},${addr!.lng}&travelmode=two-wheeler`
              : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  fullAddressString
                )}&travelmode=two-wheeler`;

            const embedMapUrl = hasGps
              ? `https://www.openstreetmap.org/export/embed.html?bbox=${
                  addr!.lng! - 0.005
                }%2C${addr!.lat! - 0.004}%2C${addr!.lng! + 0.005}%2C${
                  addr!.lat! + 0.004
                }&layer=mapnik&marker=${addr!.lat}%2C${addr!.lng}`
              : `https://maps.google.com/maps?q=${encodeURIComponent(
                  fullAddressString
                )}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

            const isCod = order.paymentMethod === "cash_on_delivery";
            const isPaid = order.paymentStatus === "paid";
            const hasReached = Boolean(order.riderReachedAt);
            const isDelivered = order.status === "delivered";
            const isBusy = busyId === order.id;
            const showMap = openMaps[order.id] ?? true;

            return (
              <div
                key={order.id}
                style={{
                  background: "var(--color-surface)",
                  border: hasReached && !isDelivered
                    ? "2px solid #059669"
                    : "1.5px solid var(--color-border)",
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                }}
              >
                {/* Top Header */}
                <div
                  style={{
                    padding: "1rem 1.2rem",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: "1rem",
                      }}
                    >
                      #{order.displayId}
                    </span>
                    {order.riderName && (
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        🛵 Rider: {order.riderName}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      background: isDelivered
                        ? "rgba(52, 211, 153, 0.16)"
                        : hasReached
                        ? "rgba(52, 211, 153, 0.16)"
                        : "rgba(96, 165, 250, 0.16)",
                      color: isDelivered
                        ? "#34D399"
                        : hasReached
                        ? "#4ADE80"
                        : "#93C5FD",
                    }}
                  >
                    {isDelivered
                      ? "✅ Delivered"
                      : hasReached
                      ? "📍 Reached Location"
                      : "🛵 Out for Delivery"}
                  </span>
                </div>

                {/* Cash to Collect / Payment Banner */}
                <div
                  style={{
                    padding: "0.85rem 1.2rem",
                    background: isPaid
                      ? "rgba(52, 211, 153, 0.16)"
                      : isCod
                      ? "rgba(251, 191, 36, 0.16)"
                      : "rgba(96, 165, 250, 0.16)",
                    color: isPaid
                      ? "#34D399"
                      : isCod
                      ? "#FCD34D"
                      : "#1E40AF",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Banknote size={18} />
                    <div>
                      <strong style={{ display: "block", fontSize: "0.84rem" }}>
                        {isPaid
                          ? isCod
                            ? `✅ CASH COLLECTED (${paise2rupee(order.totalPaise)})`
                            : "✅ PAID ONLINE (RAZORPAY)"
                          : `💵 CASH ON DELIVERY — COLLECT ${paise2rupee(order.totalPaise)}`}
                      </strong>
                      <span style={{ fontSize: "0.74rem", opacity: 0.9 }}>
                        {isPaid
                          ? "Do not collect any cash from customer"
                          : hasReached
                          ? `You have reached! Please collect ${paise2rupee(
                              order.totalPaise
                            )} cash from ${order.customerName || "customer"}`
                          : `Collect ${paise2rupee(order.totalPaise)} cash upon reaching`}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: "1.1rem" }}>
                    {isPaid ? "₹0 Due" : paise2rupee(order.totalPaise)}
                  </span>
                </div>

                {/* Customer Details + 1-Click Call + Address */}
                <div
                  style={{
                    padding: "1rem 1.2rem",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          textTransform: "uppercase",
                          color: "var(--color-text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        Customer
                      </span>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem" }}>
                        {order.customerName || "Guest"}
                      </p>
                    </div>

                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0.45rem 0.85rem",
                          borderRadius: 10,
                          background: "rgba(96, 165, 250, 0.10)",
                          color: "#93C5FD",
                          border: "1px solid #93C5FD",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          textDecoration: "none",
                        }}
                      >
                        <Phone size={14} /> Call {order.customerPhone}
                      </a>
                    )}
                  </div>

                  {/* Delivery Address */}
                  <div
                    style={{
                      padding: "0.75rem",
                      borderRadius: 10,
                      background: "var(--color-surface-alt)",
                      border: "1px solid var(--color-border)",
                      fontSize: "0.86rem",
                      lineHeight: 1.45,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      <MapPin size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{fullAddressString}</span>
                    </div>
                    {hasGps && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontSize: "0.72rem",
                          color: "#059669",
                          fontWeight: 700,
                        }}
                      >
                        📍 Exact Customer GPS Pin Available ({addr!.lat}, {addr!.lng})
                      </span>
                    )}
                  </div>

                  {/* Turn-by-Turn Navigation & Inline Map Toggle */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    <a
                      href={googleMapsNavUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "0.65rem 0.9rem",
                        borderRadius: 10,
                        background: "#2563EB",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: "0.84rem",
                        textDecoration: "none",
                      }}
                    >
                      <Navigation size={15} /> Navigate in Maps <ExternalLink size={13} />
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenMaps((prev) => ({ ...prev, [order.id]: !showMap }))
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "0.65rem 0.85rem",
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      <MapIcon size={15} /> {showMap ? "Hide Map" : "Show Map"}
                    </button>
                  </div>

                  {showMap && (
                    <div
                      style={{
                        width: "100%",
                        height: 175,
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        marginTop: "0.65rem",
                      }}
                    >
                      <iframe
                        title={`Map for Order #${order.displayId}`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={embedMapUrl}
                      />
                    </div>
                  )}
                </div>

                {/* Ordered Dishes List */}
                <div
                  style={{
                    padding: "0.85rem 1.2rem",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-surface-alt)",
                    fontSize: "0.82rem",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Dishes in Order ({order.itemCount} items)
                  </span>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "2px 0",
                      }}
                    >
                      <span>
                        <strong>{item.quantity}×</strong> {item.name}
                        {item.variantName ? ` (${item.variantName})` : ""}
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                        {paise2rupee(item.totalPaise)}
                      </span>
                    </div>
                  ))}
                  {order.specialInstructions && (
                    <p
                      style={{
                        margin: "0.4rem 0 0",
                        padding: "0.35rem 0.5rem",
                        borderRadius: 6,
                        background: "rgba(251, 191, 36, 0.10)",
                        color: "#FCD34D",
                        fontSize: "0.76rem",
                      }}
                    >
                      📝 Note: {order.specialInstructions}
                    </p>
                  )}
                </div>

                {/* Rider Action Buttons: 1) Tap "Reached" -> 2) Tap "Cash Collected" / "Mark Delivered" */}
                {!isDelivered && (
                  <div
                    style={{
                      padding: "1rem 1.2rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    {!hasReached ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRiderAction(order.id, "reached")}
                        style={{
                          width: "100%",
                          padding: "0.85rem 1rem",
                          borderRadius: 10,
                          border: "none",
                          background: "#D97706",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          cursor: isBusy ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {isBusy ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <MapPin size={16} />
                        )}
                        📍 Tap &ldquo;Reached Customer Location&rdquo;
                      </button>
                    ) : (
                      <div
                        style={{
                          padding: "0.55rem 0.8rem",
                          borderRadius: 8,
                          background: "rgba(52, 211, 153, 0.10)",
                          border: "1px solid #10B981",
                          color: "#34D399",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        ✓ Customer Notified that You Reached Location!
                        {!isPaid && isCod
                          ? ` Collect ${paise2rupee(order.totalPaise)} in Cash below:`
                          : ""}
                      </div>
                    )}

                    {isCod && !isPaid ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRiderAction(order.id, "cash_collected")}
                        style={{
                          width: "100%",
                          padding: "0.9rem 1rem",
                          borderRadius: 10,
                          border: "none",
                          background: "#059669",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          cursor: isBusy ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {isBusy ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Banknote size={16} />
                        )}
                        💵 Cash Collected ({paise2rupee(order.totalPaise)}) &amp; Mark Delivered
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRiderAction(order.id, "delivered")}
                        style={{
                          width: "100%",
                          padding: "0.9rem 1rem",
                          borderRadius: 10,
                          border: "none",
                          background: "#059669",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          cursor: isBusy ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {isBusy ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        ✅ Order Handed Over (Mark Delivered)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
