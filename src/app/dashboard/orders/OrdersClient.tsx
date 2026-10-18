"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle, ChefHat, Package, Truck, XCircle, RefreshCw, Bell } from "lucide-react";
import styles from "./orders.module.css";

// ── Types ─────────────────────────────────────────────────────
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled" | "rejected";
export type OrderType = "delivery" | "pickup" | "dine_in";

export interface Order {
  id: string;
  displayId: string;
  customerName: string | null;
  customerPhone: string | null;
  orderType: OrderType;
  status: OrderStatus;
  totalPaise: number;
  createdAt: string;
  itemCount: number;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ComponentType<{ size?: number }>; color: string; bg: string }> = {
  pending:   { label: "Pending",   icon: Clock,        color: "#D97706", bg: "#FEF3C7" },
  confirmed: { label: "Confirmed", icon: CheckCircle,  color: "#2563EB", bg: "#DBEAFE" },
  preparing: { label: "Preparing", icon: ChefHat,      color: "#7C3AED", bg: "#EDE9FE" },
  ready:     { label: "Ready",     icon: Package,      color: "#059669", bg: "#D1FAE5" },
  out_for_delivery: { label: "Out for delivery", icon: Truck, color: "#0891B2", bg: "#CFFAFE" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "#DC2626", bg: "#FEE2E2" },
  delivered: { label: "Delivered", icon: Truck,        color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "#DC2626", bg: "#FEE2E2" },
};

const orderTypeEmoji: Record<OrderType, string> = {
  delivery: "🛵",
  pickup:   "🏃",
  dine_in:  "🪑",
};

function getNextStatus(order: Order): OrderStatus | undefined {
  switch (order.status) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return order.orderType === "delivery" ? "out_for_delivery" : "delivered";
    case "out_for_delivery":
      return "delivered";
    default:
      return undefined;
  }
}

const paise2rupee = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

// ── Status filters ─────────────────────────────────────────────
const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all",              label: "All" },
  { key: "pending",          label: "Pending" },
  { key: "confirmed",        label: "Confirmed" },
  { key: "preparing",        label: "Preparing" },
  { key: "ready",            label: "Ready" },
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
      setOrders((prev) => [order, ...prev]);
      setLastPing(new Date());
      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("New Order!", {
          body: `#${order.displayId} — ${order.orderType} — ${paise2rupee(order.totalPaise)}`,
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

  // ── Update status ──────────────────────────────────────────
  const updateStatus = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/dashboard/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated: Order = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      }
    } finally {
      setUpdating(null);
    }
  }, []);

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
            const next = getNextStatus(order);
            const nextCfg = next ? statusConfig[next] : null;
            const isUpdating = updating === order.id;

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

                {/* Customer */}
                <div className={styles.orderCustomer}>
                  <span className={styles.customerName}>{order.customerName || "Guest"}</span>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className={styles.customerPhone}>
                      {order.customerPhone}
                    </a>
                  )}
                </div>

                {/* Meta */}
                <div className={styles.orderMeta}>
                  <span>{order.itemCount} item{order.itemCount !== 1 ? "s" : ""}</span>
                  <span className={styles.orderPrice}>{paise2rupee(order.totalPaise)}</span>
                  <span className={styles.orderTime}>
                    {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Action */}
                {next && (
                  <button
                    className={styles.advanceBtn}
                    onClick={() => updateStatus(order.id, next)}
                    disabled={isUpdating}
                    style={{ background: nextCfg?.color }}
                  >
                    {isUpdating ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      nextCfg && <nextCfg.icon size={14} />
                    )}
                    Mark as {nextCfg?.label}
                  </button>
                )}

                {/* Reject / Cancel */}
                {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "rejected" && (
                  <button
                    className={styles.cancelBtn}
                    onClick={() => updateStatus(order.id, order.status === "pending" ? "rejected" : "cancelled")}
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
