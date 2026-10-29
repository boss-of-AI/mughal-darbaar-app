"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock,
  CheckCircle,
  ChefHat,
  Package,
  Truck,
  XCircle,
  RefreshCw,
  Bell,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  MapPin,
  Receipt,
} from "lucide-react";
import type { DashboardOrderPayload } from "@/lib/sse";
import type { StoreAvailabilityResult } from "@/lib/store-hours";
import styles from "./orders.module.css";

// ── Types ─────────────────────────────────────────────────────
export type OrderStatus = DashboardOrderPayload["status"];
export type OrderType = DashboardOrderPayload["orderType"];
export type Order = DashboardOrderPayload;
export interface RiderOption {
  id: string;
  name: string;
  phone: string | null;
}
type SectionMode = "online" | "dine_in";

// Pleasant multi-tone restaurant order chime via Web Audio API
function playOrderChime(type: "new_order" | "bill_generated" = "new_order") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes =
      type === "bill_generated"
        ? [587.33, 783.99, 987.77, 1174.66] // D5 -> G5 -> B5 -> D6 (Bill requested bell)
        : [523.25, 659.25, 783.99, 1046.5]; // C5 -> E5 -> G5 -> C6 (New order chime)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.13);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + idx * 0.13 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.13 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.13);
      osc.stop(ctx.currentTime + idx * 0.13 + 0.46);
    });
  } catch {
    // Ignore if audio context is blocked before user interaction
  }
}

function getStatusBadgeConfig(order: Order): {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  bg: string;
} {
  if (order.orderType === "dine_in") {
    switch (order.status) {
      case "pending":
        return { label: "New · To Accept", icon: Clock, color: "#D97706", bg: "#FEF3C7" };
      case "confirmed":
      case "preparing":
        return { label: "Order Accepted", icon: ChefHat, color: "#2563EB", bg: "#DBEAFE" };
      case "ready":
        return { label: "Order Is Ready", icon: Package, color: "#7C3AED", bg: "#EDE9FE" };
      case "out_for_delivery":
        return { label: "Final Bill Generated", icon: Receipt, color: "#B45309", bg: "#FEF3C7" };
      case "delivered":
        return { label: "Paid at Counter", icon: CheckCircle, color: "#059669", bg: "#D1FAE5" };
      case "rejected":
        return { label: "Rejected", icon: XCircle, color: "#DC2626", bg: "#FEE2E2" };
      case "cancelled":
        return { label: "Cancelled", icon: XCircle, color: "#DC2626", bg: "#FEE2E2" };
    }
  }

  switch (order.status) {
    case "pending":
      return { label: "New · To Accept", icon: Clock, color: "#D97706", bg: "#FEF3C7" };
    case "confirmed":
    case "preparing":
      return { label: "Order Placed", icon: CheckCircle, color: "#2563EB", bg: "#DBEAFE" };
    case "ready":
      return { label: "Food Ready for Rider", icon: Package, color: "#7C3AED", bg: "#EDE9FE" };
    case "out_for_delivery":
      return { label: "Out for Delivery", icon: Truck, color: "#0891B2", bg: "#CFFAFE" };
    case "delivered":
      return { label: "Delivered", icon: CheckCircle, color: "#059669", bg: "#D1FAE5" };
    case "rejected":
      return { label: "Rejected", icon: XCircle, color: "#DC2626", bg: "#FEE2E2" };
    case "cancelled":
      return { label: "Cancelled", icon: XCircle, color: "#DC2626", bg: "#FEE2E2" };
  }
}

const orderTypeEmoji: Record<OrderType, string> = {
  delivery: "🛵",
  pickup: "🏃",
  dine_in: "🪑",
};

const paise2rupee = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

function getPaymentBadge(order: Order): {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  isPaid: boolean;
} {
  const amt = paise2rupee(order.totalPaise);
  const sessionAmt = paise2rupee(order.sessionTotalPaise || order.totalPaise);

  if (order.paymentStatus === "refunded" || order.refundStatus === "processed") {
    return {
      label: "REFUNDED TO CUSTOMER",
      sublabel: order.refundToken
        ? `Token Verified (${order.refundToken})`
        : `Refunded ${amt}`,
      color: "#047857",
      bg: "#D1FAE5",
      isPaid: true,
    };
  }

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
      label: order.orderType === "dine_in" ? "PAID AT COUNTER" : "PAID",
      sublabel:
        order.orderType === "dine_in"
          ? `Cash Settled (${sessionAmt})`
          : order.paymentMethod === "cash_on_delivery"
          ? "Cash Collected"
          : "Paid at Counter",
      color: "#047857",
      bg: "#D1FAE5",
      isPaid: true,
    };
  }
  if (order.orderType === "dine_in") {
    if (order.status === "out_for_delivery" || order.sessionBillGenerated) {
      return {
        label: "FINAL BILL GENERATED · UNPAID",
        sublabel:
          order.sessionOrderCount > 1
            ? `Collect Combined Bill ${sessionAmt} at Counter`
            : `Collect ${amt} at Counter`,
        color: "#B45309",
        bg: "#FEF3C7",
        isPaid: false,
      };
    }
    return {
      label: "DINE-IN · UNPAID",
      sublabel:
        order.sessionOrderCount > 1
          ? `Running Table Total: ${sessionAmt} (${order.sessionOrderCount} orders)`
          : `Pay at Counter after meal (${amt})`,
      color: "#92400E",
      bg: "#FFFBEB",
      isPaid: false,
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

function getNextAction(
  order: Order,
  userRole: string
): {
  nextStatus?: OrderStatus;
  markPaid?: boolean;
  buttonLabel: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
} | null {
  const isChef = userRole === "chef";

  if (order.orderType === "dine_in") {
    switch (order.status) {
      case "pending":
        return {
          nextStatus: "confirmed",
          buttonLabel: isChef
            ? "👨‍🍳 Accept & Start Cooking"
            : "✓ Accept Order (Mark Order Accepted)",
          color: "#059669",
          icon: CheckCircle,
        };
      case "confirmed":
      case "preparing":
        return {
          nextStatus: "ready",
          buttonLabel: "🍽️ Mark Order Is Ready",
          color: "#7C3AED",
          icon: Package,
        };
      case "out_for_delivery":
        if (isChef) return null; // Counter staff settles final bill at counter
        return {
          nextStatus: "delivered",
          markPaid: true,
          buttonLabel: `💵 Mark Final Bill Paid at Counter (${paise2rupee(
            order.sessionTotalPaise || order.totalPaise
          )})`,
          color: "#059669",
          icon: Banknote,
        };
      default:
        return null;
    }
  }

  // Online / Delivery / Pickup flow
  switch (order.status) {
    case "pending":
      return {
        nextStatus: "confirmed",
        buttonLabel: isChef
          ? "👨‍🍳 Accept & Start Cooking"
          : "✓ Accept Order (Mark as Order Placed)",
        color: "#059669",
        icon: CheckCircle,
      };
    case "confirmed":
    case "preparing":
      if (isChef) {
        return {
          nextStatus: "ready",
          buttonLabel: "🍽️ Mark Food Ready for Dispatch",
          color: "#7C3AED",
          icon: Package,
        };
      }
      return {
        nextStatus: "out_for_delivery",
        buttonLabel: "🛵 Out for Delivery",
        color: "#0891B2",
        icon: Truck,
      };
    case "ready":
      if (isChef) return null; // Staff/Owner allots & dispatches rider
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

const onlineTabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All Online" },
  { key: "pending", label: "New (To Accept)" },
  { key: "confirmed", label: "Order Placed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "rejected", label: "Rejected & Refunds" },
];

const dineInTabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All Dine-In" },
  { key: "pending", label: "New (To Accept)" },
  { key: "confirmed", label: "Order Accepted" },
  { key: "ready", label: "Order Is Ready" },
  { key: "out_for_delivery", label: "Final Bill Generated" },
  { key: "delivered", label: "Paid at Counter" },
];

export default function OrdersClient({
  initial,
  riders = [],
  userRole = "staff",
  initialStoreStatus,
}: {
  initial: Order[];
  riders?: RiderOption[];
  userRole?: string;
  initialStoreStatus?: StoreAvailabilityResult;
}) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [storeStatus, setStoreStatus] = useState<StoreAvailabilityResult | undefined>(
    initialStoreStatus
  );
  const [openTimeInput, setOpenTimeInput] = useState(
    initialStoreStatus?.todayOpen || "12:00"
  );
  const [closeTimeInput, setCloseTimeInput] = useState(
    initialStoreStatus?.todayClose || "23:30"
  );
  const [savingTimings, setSavingTimings] = useState(false);
  const [timingsMsg, setTimingsMsg] = useState<string | null>(null);
  const [refundTokenInputs, setRefundTokenInputs] = useState<Record<string, string>>({});
  const [refundErrors, setRefundErrors] = useState<Record<string, string>>({});
  const [section, setSection] = useState<SectionMode>(() => {
    const hasPendingDineIn = initial.some(
      (o) => o.orderType === "dine_in" && (o.status === "pending" || o.status === "out_for_delivery")
    );
    const hasPendingOnline = initial.some(
      (o) => o.orderType !== "dine_in" && o.status === "pending"
    );
    if (hasPendingDineIn && !hasPendingOnline) return "dine_in";
    return "online";
  });
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<Date>(new Date());
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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

      // Auto-switch section to show the incoming order if user is on the other section
      if (order.orderType === "dine_in") {
        setSection("dine_in");
      } else {
        setSection("online");
      }

      if (soundEnabledRef.current) {
        playOrderChime("new_order");
      }

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const modeTag =
          order.orderType === "dine_in"
            ? `🪑 ${order.tableName || "Dine-In"}`
            : "🛵 Online Delivery";
        new Notification(`New Order — ${modeTag}`, {
          body: `#${order.displayId} · ${paise2rupee(order.totalPaise)}`,
          icon: "/favicon.ico",
        });
      }
    });

    es.addEventListener("order_updated", (e) => {
      const updated: Order = JSON.parse(e.data);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setLastPing(new Date());
    });

    es.addEventListener("bill_generated", (e) => {
      const updated: Order = JSON.parse(e.data);
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === updated.id) return updated;
          if (
            updated.tableSessionId &&
            o.tableSessionId === updated.tableSessionId &&
            o.status !== "cancelled" &&
            o.status !== "rejected" &&
            o.status !== "delivered"
          ) {
            return {
              ...o,
              status: "out_for_delivery",
              sessionBillGenerated: true,
              sessionTotalPaise: updated.sessionTotalPaise,
              sessionOrderCount: updated.sessionOrderCount,
            };
          }
          return o;
        })
      );
      setLastPing(new Date());
      setSection("dine_in");

      if (soundEnabledRef.current) {
        playOrderChime("bill_generated");
      }

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`🧾 Final Bill Generated — ${updated.tableName || "Dine-In Table"}`, {
          body: `Customer requested Final Total Bill: ${paise2rupee(
            updated.sessionTotalPaise || updated.totalPaise
          )}`,
          icon: "/favicon.ico",
        });
      }
    });

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // ── Update status or payment ───────────────────────────────
  const updateOrder = useCallback(
    async (
      orderId: string,
      patch: {
        status?: OrderStatus;
        paymentStatus?: Order["paymentStatus"];
        riderId?: string | null;
      }
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
          setOrders((prev) =>
            prev.map((o) => {
              if (o.id === updated.id) return updated;
              // If entire table session was settled at counter, reflect immediately
              if (
                updated.tableSessionId &&
                o.tableSessionId === updated.tableSessionId &&
                updated.paymentStatus === "paid" &&
                o.status !== "cancelled" &&
                o.status !== "rejected"
              ) {
                return {
                  ...o,
                  paymentStatus: "paid",
                  status: "delivered",
                };
              }
              return o;
            })
          );
        }
      } finally {
        setUpdating(null);
      }
    },
    []
  );

  // Allow staff to also trigger Final Bill Generation if customer asks at counter
  const triggerGenerateBill = useCallback(async (orderId: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/generate-bill`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          const updated: Order = data.order;
          setOrders((prev) =>
            prev.map((o) => {
              if (o.id === updated.id) return updated;
              if (
                updated.tableSessionId &&
                o.tableSessionId === updated.tableSessionId &&
                o.status !== "cancelled" &&
                o.status !== "rejected" &&
                o.status !== "delivered"
              ) {
                return {
                  ...o,
                  status: "out_for_delivery",
                  sessionBillGenerated: true,
                };
              }
              return o;
            })
          );
        }
      }
    } finally {
      setUpdating(null);
    }
  }, []);

  // ── Request notification permission & test sound ───────────
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      playOrderChime("new_order");
    }
  };

  const requestNotif = () => {
    playOrderChime("new_order");
    if (typeof Notification !== "undefined") {
      Notification.requestPermission();
    }
  };

  // ── Admin & Staff Order Accepting Timings Handlers ─────────
  const handleToggleStoreLive = async (nextLive: boolean) => {
    setSavingTimings(true);
    setTimingsMsg(null);
    try {
      const res = await fetch("/api/dashboard/timings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAcceptingOrders: nextLive }),
      });
      if (res.ok) {
        const updated: StoreAvailabilityResult = await res.json();
        setStoreStatus(updated);
        setTimingsMsg(
          nextLive
            ? "✓ Store is now LIVE (within Order Accepting Timings)"
            : "✓ Store set to CLOSED / Not Accepting Orders"
        );
        setTimeout(() => setTimingsMsg(null), 3500);
      }
    } finally {
      setSavingTimings(false);
    }
  };

  const handleSaveTimings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTimings(true);
    setTimingsMsg(null);
    try {
      const res = await fetch("/api/dashboard/timings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openTime: openTimeInput,
          closeTime: closeTimeInput,
          closedToday: false,
          applyScope: "all_days",
        }),
      });
      if (res.ok) {
        const updated: StoreAvailabilityResult = await res.json();
        setStoreStatus(updated);
        setTimingsMsg(`✓ Order Timings updated to ${updated.todayFormattedWindow}`);
        setTimeout(() => setTimingsMsg(null), 4000);
      }
    } finally {
      setSavingTimings(false);
    }
  };

  // ── Owner Refund Verification Handler ──────────────────────
  const handleVerifyAndRefund = async (orderId: string, tokenToVerify: string) => {
    setUpdating(orderId);
    setRefundErrors((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const res = await fetch(`/api/dashboard/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenToVerify }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefundErrors((prev) => ({
          ...prev,
          [orderId]: data.error ?? "Refund token verification failed",
        }));
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
    } finally {
      setUpdating(null);
    }
  };

  // ── Partition orders into 2 sections: Online vs Dine-In ────
  const onlineOrders = orders.filter((o) => o.orderType !== "dine_in");
  const dineInOrders = orders.filter((o) => o.orderType === "dine_in");
  const pendingRefundCount = orders.filter(
    (o) =>
      (o.status === "rejected" || o.status === "cancelled") &&
      o.refundStatus === "requested" &&
      o.paymentStatus !== "refunded"
  ).length;

  const onlineActionCount = onlineOrders.filter((o) => o.status === "pending").length;
  const dineInActionCount = dineInOrders.filter(
    (o) => o.status === "pending" || o.status === "out_for_delivery"
  ).length;

  const activeSectionOrders = section === "online" ? onlineOrders : dineInOrders;
  const activeTabs = section === "online" ? onlineTabs : dineInTabs;

  const filtered =
    filter === "all"
      ? activeSectionOrders
      : activeSectionOrders.filter((o) => {
          if (section === "online" && filter === "confirmed") {
            return o.status === "confirmed" || o.status === "preparing" || o.status === "ready";
          }
          if (filter === "rejected") {
            return o.status === "rejected" || o.status === "cancelled";
          }
          return o.status === filter;
        });

  const counts = activeSectionOrders.reduce((acc, o) => {
    const key =
      section === "online" && (o.status === "preparing" || o.status === "ready")
        ? "confirmed"
        : o.status === "cancelled"
        ? "rejected"
        : o.status;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {userRole === "chef" ? "👨‍🍳 Kitchen Order Board" : "Live Orders"}
          </h1>
          <p className={styles.pageSubtitle}>
            <span
              className={`${styles.connDot} ${
                connected ? styles.connDotOn : styles.connDotOff
              }`}
            />
            {connected ? "Live — updates in real time" : "Connecting…"}
            <span className={styles.lastPing}> · Last: {lastPing.toLocaleTimeString()}</span>
            {userRole === "chef" && (
              <span
                style={{
                  marginLeft: "0.5rem",
                  padding: "0.18rem 0.55rem",
                  borderRadius: 999,
                  background: "#FFFBEB",
                  border: "1px solid #FCD34D",
                  color: "#B45309",
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              >
                👨‍🍳 Chef Mode: Kitchen Prep &amp; Dish Readiness
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleToggleSound}
            className="btn btn--secondary btn--sm"
            title="Toggle order notification sound & test chime"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? "Sound ON (Test Bell)" : "Sound Muted"}
          </button>
          <button
            type="button"
            onClick={requestNotif}
            className="btn btn--secondary btn--sm"
            title="Enable browser notifications for new orders"
          >
            <Bell size={15} /> Enable Alerts
          </button>
          {userRole === "owner" && pendingRefundCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSection("online");
                setFilter("rejected");
              }}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 999,
                border: "1.5px solid #F59E0B",
                background: "#FFFBEB",
                color: "#B45309",
                fontWeight: 800,
                fontSize: "0.76rem",
                cursor: "pointer",
              }}
            >
              🔐 {pendingRefundCount} Refund Token{pendingRefundCount > 1 ? "s" : ""} to Verify
            </button>
          )}
        </div>
      </div>

      {/* Admin & Staff Order Accepting Timings & Store Live/Closed Control Bar */}
      {userRole !== "chef" && storeStatus && (
        <div
          style={{
            padding: "0.9rem 1.15rem",
            borderRadius: 14,
            background: storeStatus.isOpenNow ? "#ECFDF5" : "#FEF2F2",
            border: storeStatus.isOpenNow
              ? "1.5px solid #10B981"
              : "1.5px solid #EF4444",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "0.28rem 0.7rem",
                borderRadius: 999,
                background: storeStatus.isOpenNow ? "#059669" : "#DC2626",
                color: "#FFFFFF",
                fontWeight: 900,
                fontSize: "0.74rem",
                letterSpacing: "0.03em",
              }}
            >
              {storeStatus.isOpenNow ? "🟢 LIVE · ACCEPTING ORDERS" : "🔴 CLOSED · NOT LIVE"}
            </span>
            <div style={{ fontSize: "0.82rem", color: "#1F2937" }}>
              <strong>Order Accepting Timings ({storeStatus.todayLabel}):</strong>{" "}
              <span style={{ fontWeight: 800 }}>{storeStatus.todayFormattedWindow}</span>
              <span style={{ marginLeft: 8, color: "#6B7280", fontSize: "0.75rem" }}>
                (IST Now: {storeStatus.currentIstTimeFormatted})
              </span>
            </div>
            {timingsMsg && (
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#047857",
                  background: "#D1FAE5",
                  padding: "0.2rem 0.55rem",
                  borderRadius: 6,
                }}
              >
                {timingsMsg}
              </span>
            )}
          </div>

          <form
            onSubmit={handleSaveTimings}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#374151",
              }}
            >
              Open:
              <input
                type="time"
                value={openTimeInput}
                onChange={(e) => setOpenTimeInput(e.target.value)}
                style={{
                  padding: "0.28rem 0.45rem",
                  borderRadius: 6,
                  border: "1px solid #D1D5DB",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: "#FFFFFF",
                }}
              />
            </label>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#374151",
              }}
            >
              Close:
              <input
                type="time"
                value={closeTimeInput}
                onChange={(e) => setCloseTimeInput(e.target.value)}
                style={{
                  padding: "0.28rem 0.45rem",
                  borderRadius: 6,
                  border: "1px solid #D1D5DB",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: "#FFFFFF",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={savingTimings}
              style={{
                padding: "0.36rem 0.7rem",
                borderRadius: 8,
                border: "1px solid #D97706",
                background: "#FFFBEB",
                color: "#92400E",
                fontSize: "0.75rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ⏰ Save Timings
            </button>
            <button
              type="button"
              disabled={savingTimings}
              onClick={() => handleToggleStoreLive(!storeStatus.isAcceptingOrdersSwitch)}
              style={{
                padding: "0.36rem 0.75rem",
                borderRadius: 8,
                border: "none",
                background: storeStatus.isAcceptingOrdersSwitch ? "#DC2626" : "#059669",
                color: "#FFFFFF",
                fontSize: "0.75rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {storeStatus.isAcceptingOrdersSwitch
                ? "🔴 Pause / Close Store Now"
                : "🟢 Set Store Live Now"}
            </button>
          </form>
        </div>
      )}

      {/* 2 Distinct Sections Switcher: Online Delivery vs Dine-In Table Orders */}
      <div className={styles.sectionSwitcher} role="region" aria-label="Order Sections">
        <button
          type="button"
          className={`${styles.sectionBtn} ${
            section === "online" ? styles.sectionBtnActive : ""
          }`}
          onClick={() => {
            setSection("online");
            setFilter("all");
          }}
        >
          <div className={styles.sectionBtnLeft}>
            <span className={styles.sectionEmoji}>🛵</span>
            <div>
              <span className={styles.sectionTitle}>Online &amp; Delivery Orders</span>
              <span className={styles.sectionDesc}>
                Order Placed ➔ Out for Delivery ➔ Delivered
              </span>
            </div>
          </div>
          <div className={styles.sectionCounters}>
            {onlineActionCount > 0 && (
              <span className={styles.sectionAlertBadge}>{onlineActionCount} New</span>
            )}
            <span className={styles.sectionCountBadge}>{onlineOrders.length} Total</span>
          </div>
        </button>

        <button
          type="button"
          className={`${styles.sectionBtn} ${
            section === "dine_in" ? styles.sectionBtnActive : ""
          }`}
          onClick={() => {
            setSection("dine_in");
            setFilter("all");
          }}
        >
          <div className={styles.sectionBtnLeft}>
            <span className={styles.sectionEmoji}>🪑</span>
            <div>
              <span className={styles.sectionTitle}>Dine-In Table Orders (QR)</span>
              <span className={styles.sectionDesc}>
                Accepted ➔ Ready ➔ Final Bill Generated ➔ Paid at Counter
              </span>
            </div>
          </div>
          <div className={styles.sectionCounters}>
            {dineInActionCount > 0 && (
              <span className={styles.sectionAlertBadge}>{dineInActionCount} Action</span>
            )}
            <span className={styles.sectionCountBadge}>{dineInOrders.length} Total</span>
          </div>
        </button>
      </div>

      {/* Status Tabs for Active Section */}
      <div className={styles.tabs} role="tablist">
        {activeTabs.map((t) => (
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
              <span className={styles.tabBadge}>{activeSectionOrders.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyEmoji}>{section === "dine_in" ? "🪑" : "🛵"}</span>
          <p>
            No {filter === "all" ? "" : filter.replace(/_/g, " ")}{" "}
            {section === "dine_in" ? "Dine-In Table" : "Online Delivery"} orders
          </p>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filtered.map((order) => {
            const cfg = getStatusBadgeConfig(order);
            const StatusIcon = cfg.icon;
            const nextAction = getNextAction(order, userRole);
            const isUpdating = updating === order.id;
            const payBadge = getPaymentBadge(order);

            return (
              <div
                key={order.id}
                className={`${styles.orderCard} ${
                  order.status === "pending" ||
                  (order.orderType === "dine_in" && order.status === "out_for_delivery")
                    ? styles.orderCardNew
                    : ""
                }`}
              >
                {/* Top row */}
                <div className={styles.orderCardHeader}>
                  <div className={styles.orderCardLeft}>
                    <span className={styles.orderEmoji} aria-hidden="true">
                      {orderTypeEmoji[order.orderType]}
                    </span>
                    <div>
                      <span className={styles.orderId}>#{order.displayId}</span>
                      <span className={styles.orderType}>
                        {order.orderType.replace("_", " ")}
                      </span>
                      {order.orderType === "dine_in" && (
                        <span className={styles.tableBadge}>
                          🪑 {order.tableName || "Table Order"}
                        </span>
                      )}
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

                {/* Multi-Order Combined Table Session Bar (for Dine-In) */}
                {order.orderType === "dine_in" && order.sessionOrderCount > 1 && (
                  <div className={styles.sessionSummaryBar}>
                    <span>
                      🧾 <strong>Table Session ({order.sessionOrderCount} Orders)</strong>
                    </span>
                    <span>
                      Combined Total:{" "}
                      <strong>{paise2rupee(order.sessionTotalPaise)}</strong>
                    </span>
                  </div>
                )}

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
                    userRole !== "chef" &&
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
                    <span className={styles.customerName}>
                      {order.customerName || "Guest"}
                    </span>
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
                        {order.deliveryAddress.landmark
                          ? ` (${order.deliveryAddress.landmark})`
                          : ""}
                        {`, ${order.deliveryAddress.city} - ${order.deliveryAddress.pincode}`}
                      </span>
                    </p>
                  )}

                  {/* Rider Allotment & Live Rider Tracking Bar (for Online Delivery Orders) */}
                  {order.orderType === "delivery" &&
                    order.status !== "cancelled" &&
                    order.status !== "rejected" && (
                      <div
                        style={{
                          marginTop: "0.65rem",
                          padding: "0.65rem 0.75rem",
                          borderRadius: 10,
                          background: order.riderReachedAt
                            ? "#ECFDF5"
                            : order.riderId
                            ? "#EFF6FF"
                            : "var(--color-surface-alt)",
                          border: order.riderReachedAt
                            ? "1.5px solid #10B981"
                            : order.riderId
                            ? "1px solid #93C5FD"
                            : "1px dashed var(--color-border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.4rem",
                            flexWrap: "wrap",
                            marginBottom: order.status !== "delivered" ? "0.45rem" : 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.76rem",
                              fontWeight: 800,
                              color: order.riderReachedAt
                                ? "#047857"
                                : order.riderId
                                ? "#1D4ED8"
                                : "var(--color-text-muted)",
                            }}
                          >
                            {order.riderReachedAt
                              ? `📍 Rider Reached Location (${order.riderName || "Rider"})`
                              : order.riderName
                              ? `🛵 Allotted Rider: ${order.riderName}`
                              : "🛵 No Rider Allotted Yet"}
                          </span>
                          {order.riderPhone && (
                            <a
                              href={`tel:${order.riderPhone}`}
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#2563EB",
                                textDecoration: "none",
                              }}
                            >
                              📞 {order.riderPhone}
                            </a>
                          )}
                        </div>

                        {order.status !== "delivered" &&
                          userRole !== "chef" &&
                          riders.length > 0 && (
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <select
                              aria-label="Select Delivery Rider"
                              value={
                                selectedRiders[order.id] ??
                                order.riderId ??
                                riders[0]?.id ??
                                ""
                              }
                              onChange={(e) =>
                                setSelectedRiders((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              style={{
                                flex: 1,
                                padding: "0.35rem 0.5rem",
                                borderRadius: 7,
                                border: "1px solid var(--color-border)",
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                background: "#fff",
                              }}
                            >
                              {riders.map((r) => {
                                const activeCount = orders.filter(
                                  (o) =>
                                    o.riderId === r.id &&
                                    !["delivered", "cancelled", "rejected"].includes(o.status)
                                ).length;
                                return (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({activeCount} active)
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                const chosenId =
                                  selectedRiders[order.id] ??
                                  order.riderId ??
                                  riders[0]?.id;
                                if (!chosenId) return;
                                updateOrder(order.id, {
                                  riderId: chosenId,
                                  status: "out_for_delivery",
                                });
                              }}
                              style={{
                                padding: "0.38rem 0.65rem",
                                borderRadius: 7,
                                border: "none",
                                background: "#2563EB",
                                color: "#fff",
                                fontSize: "0.74rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {order.riderId ? "Re-Allot" : "🛵 Allot & Dispatch"}
                            </button>
                          </div>
                        )}
                      </div>
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
                        <span className={styles.itemLinePrice}>
                          {paise2rupee(item.totalPaise)}
                        </span>
                      </div>
                    ))}
                    {order.discountPaise > 0 && (
                      <div
                        className={styles.itemRow}
                        style={{ color: "#059669", fontWeight: 700, paddingTop: 3 }}
                      >
                        <span>🏷️ Offer Discount Applied</span>
                        <span>-{paise2rupee(order.discountPaise)}</span>
                      </div>
                    )}
                    {order.specialInstructions && (
                      <p className={styles.specialNote}>📝 Note: {order.specialInstructions}</p>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className={styles.orderMeta}>
                  <span>
                    {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} (This Order)
                  </span>
                  <span className={styles.orderPrice}>{paise2rupee(order.totalPaise)}</span>
                  <span className={styles.orderTime}>
                    {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Primary Staff Action Button */}
                {nextAction && (
                  <button
                    className={styles.advanceBtn}
                    onClick={() =>
                      updateOrder(order.id, {
                        status: nextAction.nextStatus,
                        ...(nextAction.markPaid ? { paymentStatus: "paid" } : {}),
                      })
                    }
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

                {/* Dine-In: When Order Is Ready, waiting for customer to click Generate Final Total Bill (or staff can generate) */}
                {order.orderType === "dine_in" && order.status === "ready" && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      background: "#F5F3FF",
                      color: "#5B21B6",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      textAlign: "center",
                      borderBottom: "1px solid var(--color-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.45rem",
                    }}
                  >
                    <span>
                      🍽️ Served at Table — Customer can order more or click &ldquo;Generate
                      Final Total Bill&rdquo;
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerGenerateBill(order.id)}
                      disabled={isUpdating}
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderRadius: 8,
                        border: "1px solid #C4B5FD",
                        background: "#EDE9FE",
                        color: "#4C1D95",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      🧾 Generate Final Table Bill Now ({paise2rupee(order.sessionTotalPaise || order.totalPaise)})
                    </button>
                  </div>
                )}

                {/* Online Delivery: When Out for Delivery, waiting for customer to click Accept Order */}
                {order.orderType !== "dine_in" && order.status === "out_for_delivery" && (
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
                {order.status !== "cancelled" &&
                  order.status !== "delivered" &&
                  order.status !== "rejected" && (
                    <button
                      className={styles.cancelBtn}
                      onClick={() =>
                        updateOrder(order.id, {
                          status: order.status === "pending" ? "rejected" : "cancelled",
                        })
                      }
                      disabled={isUpdating}
                    >
                      {order.status === "pending" ? "Reject Order" : "Cancel Order"}
                    </button>
                  )}

                {/* Owner-to-Customer Refund Token Verification Portal (for Rejected/Cancelled Online-Paid Orders) */}
                {(order.status === "rejected" || order.status === "cancelled") &&
                  (order.paymentMethod === "razorpay" ||
                    order.paymentStatus === "paid" ||
                    order.paymentStatus === "refunded") && (
                    <div
                      style={{
                        padding: "0.85rem 1rem",
                        background:
                          order.paymentStatus === "refunded" ||
                          order.refundStatus === "processed"
                            ? "#ECFDF5"
                            : "#FFFBEB",
                        borderTop: "1.5px solid #F59E0B",
                        fontSize: "0.78rem",
                      }}
                    >
                      {order.paymentStatus === "refunded" ||
                      order.refundStatus === "processed" ? (
                        <div style={{ color: "#065F46", fontWeight: 800 }}>
                          ✅ Online Payment Refunded ({paise2rupee(order.totalPaise)})
                          {order.refundToken ? ` · Verified Token: ${order.refundToken}` : ""}
                        </div>
                      ) : userRole === "owner" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.4rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ color: "#92400E" }}>
                              🔐 Owner Refund Verification ({paise2rupee(order.totalPaise)})
                            </strong>
                            {order.refundToken ? (
                              <span
                                style={{
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: 6,
                                  background: "#FEF3C7",
                                  border: "1px solid #D97706",
                                  color: "#B45309",
                                  fontWeight: 800,
                                  fontFamily: "monospace",
                                }}
                              >
                                Customer Token: {order.refundToken}
                              </span>
                            ) : (
                              <span style={{ color: "#B45309", fontSize: "0.72rem" }}>
                                Waiting for customer to generate Refund Token…
                              </span>
                            )}
                          </div>
                          {order.refundNote && (
                            <div style={{ color: "#78350F", fontSize: "0.74rem" }}>
                              💬 Customer Note: {order.refundNote}
                            </div>
                          )}
                          {order.refundToken && (
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder="Enter token (e.g. RFD-XXXX-XXXX)"
                                value={refundTokenInputs[order.id] ?? ""}
                                onChange={(e) =>
                                  setRefundTokenInputs((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                style={{
                                  flex: 1,
                                  padding: "0.38rem 0.55rem",
                                  borderRadius: 7,
                                  border: "1px solid #D97706",
                                  fontSize: "0.76rem",
                                  fontFamily: "monospace",
                                  fontWeight: 700,
                                  background: "#FFFFFF",
                                }}
                              />
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  handleVerifyAndRefund(
                                    order.id,
                                    refundTokenInputs[order.id] ?? ""
                                  )
                                }
                                style={{
                                  padding: "0.4rem 0.7rem",
                                  borderRadius: 7,
                                  border: "none",
                                  background: "#059669",
                                  color: "#FFFFFF",
                                  fontWeight: 800,
                                  fontSize: "0.74rem",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                💸 Verify &amp; Refund
                              </button>
                            </div>
                          )}
                          {refundErrors[order.id] && (
                            <div style={{ color: "#DC2626", fontWeight: 700, fontSize: "0.73rem" }}>
                              {refundErrors[order.id]}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "#92400E", fontWeight: 700 }}>
                          🔒 Online Paid Order Rejected — Only the Restaurant Owner (Admin) can
                          verify the customer&apos;s Refund Token and process this refund.
                        </div>
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
