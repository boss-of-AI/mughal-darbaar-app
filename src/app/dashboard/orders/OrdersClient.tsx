"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CheckCircle,
  ChefHat,
  Package,
  Truck,
  XCircle,
  RefreshCw,
  Bell,
  CreditCard,
  Banknote,
  MapPin,
} from "lucide-react";
import type { DashboardOrderPayload } from "@/lib/sse";
import styles from "./orders.module.css";

// ── Types ─────────────────────────────────────────────────────
export type OrderStatus = DashboardOrderPayload["status"];
export type OrderType = DashboardOrderPayload["orderType"];
export type Order = DashboardOrderPayload;

const statusConfig: Record<OrderStatus, { label: string; icon: React.ComponentType<{ size?: number }>; color: string; bg: string }> = {
  pending:          { label: "New · To Accept",  icon: Clock,       color: "#D97706", bg: "#FEF3C7" },
  confirmed:        { label: "Order Placed",     icon: CheckCircle, color: "#2563EB", bg: "#DBEAFE" },
  preparing:        { label: "Order Placed",     icon: ChefHat,     color: "#2563EB", bg: "#DBEAFE" },
  ready:            { label: "Order Placed",     icon: Package,     color: "#2563EB", bg: "#DBEAFE" },
  out_for_delivery: { label: "Out for Delivery", icon: Truck,       color: "#0891B2", bg: "#CFFAFE" },
  rejected:         { label: "Rejected",         icon: XCircle,     color: "#DC2626", bg: "#FEE2E2" },
  delivered:        { label: "Delivered",        icon: CheckCircle, color: "#059669", bg: "#D1FAE5" },
  cancelled:        { label: "Cancelled",        icon: XCircle,     color: "#DC2626", bg: "#FEE2E2" },
};

const orderTypeEmoji: Record<OrderType, string> = {
  delivery: "🛵",
  pickup:   "🏃",
  dine_in:  "🪑",
};

function getPaymentBadge(order: Order): {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  isPaid: boolean;
} {
  const amt = `₹${(order.totalPaise / 100).toLocaleString("en-IN")}`;
  if (order.paymentStatus === "paid") {
    if (order.paymentMethod === "razorpay") {
      return {
        label: "PAID ONLINE",
        sublabel: "Razorpay Verified",
        color: "#047857",
        bg: "#D1FAE5",
        isPaid: true,
      };
    }
    return {
      label: "PAID",
      sublabel: order.paymentMethod === "cash_on_delivery" ? "Cash Collected" : "Paid at Counter",
      color: "#047857",
      bg: "#D1FAE5",
      isPaid: true,
    };
  }
  if (order.paymentMethod === "cash_on_delivery") {
    return {
      label: "CASH ON DELIVERY",
      sublabel: `Collect ${amt}`,
      color: "#B45309",
      bg: "#FEF3C7",
      isPaid: false,
    };
  }
  if (order.paymentMethod === "pay_at_counter" || order.paymentStatus === "pay_at_counter") {
    return {
      label: "PAY AT COUNTER",
      sublabel: `Collect ${amt}`,
      color: "#B45309",
      bg: "#FEF3C7",
      isPaid: false,
    };
  }
  if (order.paymentStatus === "failed") {
    return {
      label: "PAYMENT FAILED",
      sublabel: "Online attempt failed",
      color: "#DC2626",
      bg: "#FEE2E2",
      isPaid: false,
    };
  }
  return {
    label: "PAYMENT PENDING",
    sublabel: "Awaiting Razorpay",
    color: "#D97706",
    bg: "#FEF3C7",
    isPaid: false,
  };
}

function getNextAction(order: Order): {
  nextStatus: OrderStatus;
  buttonLabel: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
} | null {
  switch (order.status) {
    case "pending":
      return {
        nextStatus: "confirmed",
        buttonLabel: "✓ Accept Order (Mark as Order Placed)",
        color: "#059669",
        icon: CheckCircle,
      };
    case "confirmed":
    case "preparing":
    case "ready":
      return {
        nextStatus: "out_for_delivery",
        buttonLabel: "🛵 Out for Delivery",
        color: "#0891B2",
        icon: Truck,
      };
    default:
      return null;
  }
}

const paise2rupee = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

// ── Status filters (3-stage flow: Order Placed -> Out for Delivery -> Delivered) ──
const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all",              label: "All" },
  { key: "pending",          label: "New (To Accept)" },
  { key: "confirmed",        label: "Order Placed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered",        label: "Delivered" },
];

export default function OrdersClient({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [filter, setFilter] = useState<OrderStatus | "all">("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<Date>(new Date());
  const [connected, setConnected] = useState(false);

  // ── SSE connection ─────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/dashboard/orders/stream");

    es.addEventListener("connected", () => setConnected(true));

    es.addEventListener("new_order", (e) => {
      const order: Order = JSON.parse(e.data);
      setOrders((prev) =>
        prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [order, ...prev]
      );
      setLastPing(new Date());
      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const payTag = order.paymentStatus === "paid" ? "PAID ONLINE" : "COD/Counter";
        new Notification("New Order!", {
          body: `#${order.displayId} · ${payTag} · ${paise2rupee(order.totalPaise)}`,
          icon: "/favicon.ico",
        });
      }
    });

    es.addEventListener("order_updated", (e) => {
      const updated: Order = JSON.parse(e.data);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setLastPing(new Date());
    });

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // ── Update status or payment ───────────────────────────────
  const updateOrder = useCallback(
    async (
      orderId: string,
      patch: { status?: OrderStatus; paymentStatus?: Order["paymentStatus"] }
    ) => {
      setUpdating(orderId);
      try {
        const res = await fetch(`/api/dashboard/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const updated: Order = await res.json();
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }
      } finally {
        setUpdating(null);
      }
    },
    []
  );

  // ── Request notification permission ───────────────────────
  const requestNotif = () => {
    if (typeof Notification !== "undefined") {
      Notification.requestPermission();
    }
  };

  // ── Filtered orders ────────────────────────────────────────
  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Live Orders</h1>
          <p className={styles.pageSubtitle}>
            <span className={`${styles.connDot} ${connected ? styles.connDotOn : styles.connDotOff}`} />
            {connected ? "Live — updates in real time" : "Connecting…"}
            <span className={styles.lastPing}> · Last: {lastPing.toLocaleTimeString()}</span>
          </p>
        </div>
        <button
          onClick={requestNotif}
          className="btn btn--secondary btn--sm"
          title="Enable browser notifications for new orders"
        >
          <Bell size={15} /> Enable Notifications
        </button>
      </div>

      {/* Status Tabs */}
      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={filter === t.key}
            className={`${styles.tab} ${filter === t.key ? styles.tabActive : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
            {t.key !== "all" && counts[t.key] ? (
              <span className={styles.tabBadge}>{counts[t.key]}</span>
            ) : t.key === "all" ? (
              <span className={styles.tabBadge}>{orders.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyEmoji}>📋</span>
          <p>No {filter === "all" ? "" : filter} orders</p>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filtered.map((order) => {
            const cfg = statusConfig[order.status];
            const StatusIcon = cfg.icon;
            const nextAction = getNextAction(order);
            const isUpdating = updating === order.id;
            const payBadge = getPaymentBadge(order);

            return (
              <div
                key={order.id}
                className={`${styles.orderCard} ${order.status === "pending" ? styles.orderCardNew : ""}`}
              >
                {/* Top row */}
                <div className={styles.orderCardHeader}>
                  <div className={styles.orderCardLeft}>
                    <span className={styles.orderEmoji} aria-hidden="true">{orderTypeEmoji[order.orderType]}</span>
                    <div>
                      <span className={styles.orderId}>#{order.displayId}</span>
                      <span className={styles.orderType}>{order.orderType.replace("_", " ")}</span>
                    </div>
                  </div>
                  <span
                    className={styles.statusBadge}
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <StatusIcon size={12} />
                    {cfg.label}
                  </span>
                </div>

                {/* Payment Status Banner */}
                <div
                  className={styles.paymentBar}
                  style={{ background: payBadge.bg, color: payBadge.color }}
                >
                  <div className={styles.paymentBarLeft}>
                    {payBadge.isPaid ? <CreditCard size={14} /> : <Banknote size={14} />}
                    <div>
                      <span className={styles.paymentLabel}>{payBadge.label}</span>
                      <span className={styles.paymentSub}>{payBadge.sublabel}</span>
                    </div>
                  </div>
                  {!payBadge.isPaid &&
                    order.status !== "cancelled" &&
                    order.status !== "rejected" && (
                      <button
                        type="button"
                        className={styles.markPaidBtn}
                        disabled={isUpdating}
                        onClick={() => updateOrder(order.id, { paymentStatus: "paid" })}
                      >
                        ✓ Mark Paid
                      </button>
                    )}
                </div>

                {/* Customer & Address */}
                <div className={styles.orderCustomer}>
                  <div className={styles.customerRow}>
                    <span className={styles.customerName}>{order.customerName || "Guest"}</span>
                    {order.customerPhone && (
                      <a href={`tel:${order.customerPhone}`} className={styles.customerPhone}>
                        {order.customerPhone}
                      </a>
                    )}
                  </div>
                  {order.deliveryAddress && (
                    <p className={styles.deliveryAddr}>
                      <MapPin size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>
                        {order.deliveryAddress.line1}
                        {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ""}
                        {order.deliveryAddress.landmark ? ` (${order.deliveryAddress.landmark})` : ""}
                        {`, ${order.deliveryAddress.city} - ${order.deliveryAddress.pincode}`}
                      </span>
                    </p>
                  )}
                </div>

                {/* Ordered Items List */}
                {order.items && order.items.length > 0 && (
                  <div className={styles.itemsList}>
                    {order.items.map((item) => (
                      <div key={item.id} className={styles.itemRow}>
                        <span className={styles.itemQtyName}>
                          <strong>{item.quantity}×</strong> {item.name}
                          {item.variantName ? ` (${item.variantName})` : ""}
                        </span>
                        <span className={styles.itemLinePrice}>{paise2rupee(item.totalPaise)}</span>
                      </div>
                    ))}
                    {order.specialInstructions && (
                      <p className={styles.specialNote}>📝 Note: {order.specialInstructions}</p>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className={styles.orderMeta}>
                  <span>{order.itemCount} item{order.itemCount !== 1 ? "s" : ""}</span>
                  <span className={styles.orderPrice}>{paise2rupee(order.totalPaise)}</span>
                  <span className={styles.orderTime}>
                    {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Chef / Staff Action Button */}
                {nextAction && (
                  <button
                    className={styles.advanceBtn}
                    onClick={() => updateOrder(order.id, { status: nextAction.nextStatus })}
                    disabled={isUpdating}
                    style={{ background: nextAction.color }}
                  >
                    {isUpdating ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <nextAction.icon size={14} />
                    )}
                    {nextAction.buttonLabel}
                  </button>
                )}

                {/* When Out for Delivery: Waiting for Customer to click Accept Order */}
                {order.status === "out_for_delivery" && (
                  <div
                    style={{
                      padding: "0.75rem 1.25rem",
                      background: "#ECFEFF",
                      color: "#0E7490",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      textAlign: "center",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    🛵 Out for Delivery — Waiting for customer to click &ldquo;Accept Order&rdquo;
                  </div>
                )}

                {/* Reject / Cancel */}
                {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "rejected" && (
                  <button
                    className={styles.cancelBtn}
                    onClick={() => updateOrder(order.id, { status: order.status === "pending" ? "rejected" : "cancelled" })}
                    disabled={isUpdating}
                  >
                    {order.status === "pending" ? "Reject Order" : "Cancel Order"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
