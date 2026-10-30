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
  Calendar,
  History,
  Trash2,
  EyeOff,
  Eye,
  ShieldCheck,
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
type TimePeriodTab = "today" | "past_week";
type SystematicTabKey = "new" | "pending" | "completed" | "rejected" | "all";

const HIDDEN_PAST_ORDERS_STORAGE_KEY = "mughal_darbaar_hidden_past_orders_v1";

/**
 * Returns YYYY-MM-DD in Asia/Kolkata (IST) so client and server agree on Today vs Past Orders.
 */
function getIstDateKey(dateInput: Date | string): string {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

function isOrderFromTodayIst(createdAtIso: string, todayKey: string): boolean {
  return getIstDateKey(createdAtIso) === todayKey;
}

/**
 * Classifies an order into the systematic tabs requested for Admin, Staff, and Chef:
 * - "new": Newly arrived orders waiting to be accepted (`pending`)
 * - "pending": In-progress orders (`confirmed`, `preparing`, `ready`, `out_for_delivery`)
 * - "completed": Completed & settled orders (`delivered`)
 * - "rejected": Rejected or cancelled orders (`rejected`, `cancelled`)
 */
function getOrderSystematicGroup(order: Order): Exclude<SystematicTabKey, "all"> {
  if (order.status === "pending") return "new";
  if (
    order.status === "confirmed" ||
    order.status === "preparing" ||
    order.status === "ready" ||
    order.status === "out_for_delivery"
  ) {
    return "pending";
  }
  if (order.status === "delivered") return "completed";
  return "rejected";
}

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
        return { label: "New · To Accept", icon: Clock, color: "#D97706", bg: "rgba(251, 191, 36, 0.16)" };
      case "confirmed":
      case "preparing":
        return { label: "Order Accepted", icon: ChefHat, color: "#60A5FA", bg: "rgba(96, 165, 250, 0.16)" };
      case "ready":
        return { label: "Order Is Ready", icon: Package, color: "#C4B5FD", bg: "rgba(167, 139, 250, 0.16)" };
      case "out_for_delivery":
        return { label: "Final Bill Generated", icon: Receipt, color: "#FBBF24", bg: "rgba(251, 191, 36, 0.16)" };
      case "delivered":
        return { label: "Paid at Counter", icon: CheckCircle, color: "#059669", bg: "rgba(52, 211, 153, 0.16)" };
      case "rejected":
        return { label: "Rejected", icon: XCircle, color: "#DC2626", bg: "rgba(248, 113, 113, 0.16)" };
      case "cancelled":
        return { label: "Cancelled", icon: XCircle, color: "#DC2626", bg: "rgba(248, 113, 113, 0.16)" };
    }
  }

  switch (order.status) {
    case "pending":
      return { label: "New · To Accept", icon: Clock, color: "#D97706", bg: "rgba(251, 191, 36, 0.16)" };
    case "confirmed":
    case "preparing":
      return { label: "Order Placed · Cooking", icon: CheckCircle, color: "#60A5FA", bg: "rgba(96, 165, 250, 0.16)" };
    case "ready":
      return { label: "Food Ready for Rider", icon: Package, color: "#C4B5FD", bg: "rgba(167, 139, 250, 0.16)" };
    case "out_for_delivery":
      return { label: "Out for Delivery", icon: Truck, color: "#0891B2", bg: "rgba(34, 211, 238, 0.16)" };
    case "delivered":
      return { label: "Delivered", icon: CheckCircle, color: "#059669", bg: "rgba(52, 211, 153, 0.16)" };
    case "rejected":
      return { label: "Rejected", icon: XCircle, color: "#DC2626", bg: "rgba(248, 113, 113, 0.16)" };
    case "cancelled":
      return { label: "Cancelled", icon: XCircle, color: "#DC2626", bg: "rgba(248, 113, 113, 0.16)" };
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
      color: "#34D399",
      bg: "rgba(52, 211, 153, 0.16)",
      isPaid: true,
    };
  }

  if (order.paymentStatus === "paid") {
    if (order.paymentMethod === "razorpay") {
      return {
        label: "PAID ONLINE",
        sublabel: "Razorpay Verified",
        color: "#34D399",
        bg: "rgba(52, 211, 153, 0.16)",
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
      color: "#34D399",
      bg: "rgba(52, 211, 153, 0.16)",
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
        color: "#FBBF24",
        bg: "rgba(251, 191, 36, 0.16)",
        isPaid: false,
      };
    }
    return {
      label: "DINE-IN · UNPAID",
      sublabel:
        order.sessionOrderCount > 1
          ? `Running Table Total: ${sessionAmt} (${order.sessionOrderCount} orders)`
          : `Pay at Counter after meal (${amt})`,
      color: "#FCD34D",
      bg: "rgba(251, 191, 36, 0.10)",
      isPaid: false,
    };
  }
  if (order.paymentMethod === "cash_on_delivery") {
    return {
      label: "CASH ON DELIVERY",
      sublabel: `Collect ${amt}`,
      color: "#FBBF24",
      bg: "rgba(251, 191, 36, 0.16)",
      isPaid: false,
    };
  }
  if (order.paymentMethod === "pay_at_counter" || order.paymentStatus === "pay_at_counter") {
    return {
      label: "PAY AT COUNTER",
      sublabel: `Collect ${amt}`,
      color: "#FBBF24",
      bg: "rgba(251, 191, 36, 0.16)",
      isPaid: false,
    };
  }
  if (order.paymentStatus === "failed") {
    return {
      label: "PAYMENT FAILED",
      sublabel: "Online attempt failed",
      color: "#DC2626",
      bg: "rgba(248, 113, 113, 0.16)",
      isPaid: false,
    };
  }
  return {
    label: "PAYMENT PENDING",
    sublabel: "Awaiting Razorpay",
    color: "#D97706",
    bg: "rgba(251, 191, 36, 0.16)",
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

const SYSTEMATIC_TABS: {
  key: SystematicTabKey;
  label: string;
  onlineDesc: string;
  dineInDesc: string;
}[] = [
  {
    key: "new",
    label: "🆕 New Orders",
    onlineDesc: "To Accept",
    dineInDesc: "To Accept",
  },
  {
    key: "pending",
    label: "⏳ Pending Orders",
    onlineDesc: "Cooking / Ready / Out for Delivery",
    dineInDesc: "Cooking / Ready / Final Bill",
  },
  {
    key: "completed",
    label: "✅ Completed Orders",
    onlineDesc: "Delivered",
    dineInDesc: "Paid at Counter",
  },
  {
    key: "rejected",
    label: "❌ Rejected & Refunds",
    onlineDesc: "Rejected / Cancelled",
    dineInDesc: "Rejected / Cancelled",
  },
  {
    key: "all",
    label: "📋 All Orders",
    onlineDesc: "Every status",
    dineInDesc: "Every status",
  },
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

  // ── Primary Time Period Tab: Today's Orders vs Past Week Orders ──
  const [timePeriod, setTimePeriod] = useState<TimePeriodTab>("today");

  // ── Hidden Past Orders (persisted in localStorage for Admin) ──
  const [hiddenOrderIds, setHiddenOrderIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HIDDEN_PAST_ORDERS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showHiddenPastOrders, setShowHiddenPastOrders] = useState(false);
  const [pastActionFeedback, setPastActionFeedback] = useState<string | null>(null);
  const [bulkDeletingPast, setBulkDeletingPast] = useState(false);

  const [section, setSection] = useState<SectionMode>(() => {
    const todayKey = getIstDateKey(new Date());
    const todayInitial = initial.filter((o) => isOrderFromTodayIst(o.createdAt, todayKey));
    const hasPendingDineIn = todayInitial.some(
      (o) =>
        o.orderType === "dine_in" &&
        (o.status === "pending" || o.status === "out_for_delivery")
    );
    const hasPendingOnline = todayInitial.some(
      (o) => o.orderType !== "dine_in" && o.status === "pending"
    );
    if (hasPendingDineIn && !hasPendingOnline) return "dine_in";
    return "online";
  });

  // Default systematic tab: start on "new" if there are new orders today, else "pending" if active orders exist, else "all"
  const [systematicTab, setSystematicTab] = useState<SystematicTabKey>(() => {
    const todayKey = getIstDateKey(new Date());
    const todayInitial = initial.filter((o) => isOrderFromTodayIst(o.createdAt, todayKey));
    if (todayInitial.some((o) => o.status === "pending")) return "new";
    if (
      todayInitial.some(
        (o) =>
          o.status === "confirmed" ||
          o.status === "preparing" ||
          o.status === "ready" ||
          o.status === "out_for_delivery"
      )
    ) {
      return "pending";
    }
    return "all";
  });

  const [updating, setUpdating] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<Date>(new Date());
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const persistHiddenIds = useCallback((nextIds: string[]) => {
    setHiddenOrderIds(nextIds);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          HIDDEN_PAST_ORDERS_STORAGE_KEY,
          JSON.stringify(nextIds)
        );
      } catch {
        // Ignore storage quota errors
      }
    }
  }, []);

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

      // Switch to Today's Orders + appropriate section & "New Orders" tab on incoming order
      setTimePeriod("today");
      if (order.orderType === "dine_in") {
        setSection("dine_in");
      } else {
        setSection("online");
      }
      setSystematicTab("new");

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

    es.addEventListener("order_deleted", (e) => {
      const data: { id: string } = JSON.parse(e.data);
      setOrders((prev) => prev.filter((o) => o.id !== data.id));
      setLastPing(new Date());
    });

    es.addEventListener("orders_bulk_deleted", (e) => {
      const data: { deletedIds: string[] } = JSON.parse(e.data);
      const idSet = new Set(data.deletedIds || []);
      setOrders((prev) => prev.filter((o) => !idSet.has(o.id)));
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
      setTimePeriod("today");
      setSection("dine_in");
      setSystematicTab("pending");

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

    es.addEventListener("refund_requested", (e) => {
      const updated: Order = JSON.parse(e.data);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setLastPing(new Date());
      if (soundEnabledRef.current) {
        playOrderChime("bill_generated");
      }
    });

    es.addEventListener("store_status_updated", (e) => {
      const nextStatus: StoreAvailabilityResult = JSON.parse(e.data);
      setStoreStatus(nextStatus);
      setOpenTimeInput(nextStatus.todayOpen);
      setCloseTimeInput(nextStatus.todayClose);
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

  // ── Admin Hide / Delete Past Orders (Except Today's) ───────
  const handleToggleHidePastOrder = (orderId: string) => {
    if (hiddenOrderIds.includes(orderId)) {
      persistHiddenIds(hiddenOrderIds.filter((id) => id !== orderId));
      setPastActionFeedback("👁️ Past order unhidden.");
    } else {
      persistHiddenIds([...hiddenOrderIds, orderId]);
      setPastActionFeedback("🙈 Past order hidden from view.");
    }
    setTimeout(() => setPastActionFeedback(null), 3000);
  };

  const handleHideAllPastOrders = (pastIds: string[]) => {
    const merged = Array.from(new Set([...hiddenOrderIds, ...pastIds]));
    persistHiddenIds(merged);
    setPastActionFeedback(`🙈 Hidden ${pastIds.length} past orders from view.`);
    setTimeout(() => setPastActionFeedback(null), 3500);
  };

  const handleUnhideAllPastOrders = () => {
    persistHiddenIds([]);
    setShowHiddenPastOrders(false);
    setPastActionFeedback("👁️ Restored all hidden past orders.");
    setTimeout(() => setPastActionFeedback(null), 3500);
  };

  const handleDeletePastOrder = async (order: Order) => {
    const ok = window.confirm(
      `Delete past order #${order.displayId} (${paise2rupee(
        order.totalPaise
      )}) permanently? Today's orders are never affected.`
    );
    if (!ok) return;

    setUpdating(order.id);
    try {
      const res = await fetch(`/api/dashboard/orders/${order.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setPastActionFeedback(`⚠️ ${data.error ?? "Could not delete order"}`);
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setPastActionFeedback(`🗑️ Deleted past order #${order.displayId}.`);
      setTimeout(() => setPastActionFeedback(null), 3500);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkDeleteAllPastOrders = async (pastCount: number) => {
    const ok = window.confirm(
      `Are you sure you want to permanently DELETE all ${pastCount} past orders from before today? (Today's live orders are strictly protected and will NOT be deleted.)`
    );
    if (!ok) return;

    setBulkDeletingPast(true);
    try {
      const res = await fetch("/api/dashboard/orders/past", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setPastActionFeedback(`⚠️ ${data.error ?? "Failed to delete past orders"}`);
        return;
      }
      const deletedIds = new Set<string>(data.deletedIds || []);
      setOrders((prev) => prev.filter((o) => !deletedIds.has(o.id)));
      persistHiddenIds([]);
      setPastActionFeedback(
        `🗑️ Deleted ${data.deletedCount ?? pastCount} past orders. Today's orders remain untouched.`
      );
      setTimeout(() => setPastActionFeedback(null), 4000);
    } finally {
      setBulkDeletingPast(false);
    }
  };

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

  // ── Step 1: Split Orders into Today's Orders vs Past Week / Earlier Orders (IST) ──
  const todayIstKey = getIstDateKey(new Date());
  const allTodayOrders = orders.filter((o) => isOrderFromTodayIst(o.createdAt, todayIstKey));
  const allPastOrdersRaw = orders.filter((o) => !isOrderFromTodayIst(o.createdAt, todayIstKey));

  const hiddenPastOrdersCount = allPastOrdersRaw.filter((o) =>
    hiddenOrderIds.includes(o.id)
  ).length;

  const visiblePastOrders = showHiddenPastOrders
    ? allPastOrdersRaw
    : allPastOrdersRaw.filter((o) => !hiddenOrderIds.includes(o.id));

  const periodOrders = timePeriod === "today" ? allTodayOrders : visiblePastOrders;

  const todayActionCount = allTodayOrders.filter(
    (o) =>
      o.status === "pending" ||
      (o.orderType === "dine_in" && o.status === "out_for_delivery")
  ).length;

  const pendingRefundCount = orders.filter(
    (o) =>
      (o.status === "rejected" || o.status === "cancelled") &&
      o.refundStatus === "requested" &&
      o.paymentStatus !== "refunded"
  ).length;

  // ── Step 2: Partition current time-period orders into Online vs Dine-In ──
  const onlineOrders = periodOrders.filter((o) => o.orderType !== "dine_in");
  const dineInOrders = periodOrders.filter((o) => o.orderType === "dine_in");

  const onlineActionCount = onlineOrders.filter((o) => o.status === "pending").length;
  const dineInActionCount = dineInOrders.filter(
    (o) => o.status === "pending" || o.status === "out_for_delivery"
  ).length;

  const activeSectionOrders = section === "online" ? onlineOrders : dineInOrders;

  // ── Step 3: Systematic Status Group Counts (New, Pending, Completed, Rejected, All) ──
  const systematicCounts = activeSectionOrders.reduce(
    (acc, o) => {
      const grp = getOrderSystematicGroup(o);
      acc[grp] = (acc[grp] ?? 0) + 1;
      acc.all += 1;
      return acc;
    },
    { new: 0, pending: 0, completed: 0, rejected: 0, all: 0 } as Record<
      SystematicTabKey,
      number
    >
  );

  const filtered =
    systematicTab === "all"
      ? activeSectionOrders
      : activeSectionOrders.filter((o) => getOrderSystematicGroup(o) === systematicTab);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {userRole === "chef" ? "👨‍🍳 Kitchen Order Board" : "Live Orders Dashboard"}
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
                  background: "rgba(251, 191, 36, 0.10)",
                  border: "1px solid #FCD34D",
                  color: "#FBBF24",
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              >
                👨‍🍳 Chef Mode: Systematic Kitchen Prep &amp; Dish Readiness
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
                setSystematicTab("rejected");
              }}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 999,
                border: "1.5px solid #F59E0B",
                background: "rgba(251, 191, 36, 0.10)",
                color: "#FBBF24",
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
            background: storeStatus.isOpenNow ? "rgba(52, 211, 153, 0.10)" : "rgba(248, 113, 113, 0.10)",
            border: storeStatus.isOpenNow
              ? "1.5px solid #10B981"
              : "1.5px solid #EF4444",
            marginBottom: "1.1rem",
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
            <div style={{ fontSize: "0.82rem", color: "#E5E7EB" }}>
              <strong>Order Accepting Timings ({storeStatus.todayLabel}):</strong>{" "}
              <span style={{ fontWeight: 800 }}>{storeStatus.todayFormattedWindow}</span>
              <span style={{ marginLeft: 8, color: "#9CA3AF", fontSize: "0.75rem" }}>
                (IST Now: {storeStatus.currentIstTimeFormatted})
              </span>
            </div>
            {timingsMsg && (
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#34D399",
                  background: "rgba(52, 211, 153, 0.16)",
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
                color: "#D1D5DB",
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
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: "var(--color-surface-alt)",
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
                color: "#D1D5DB",
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
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: "var(--color-surface-alt)",
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
                background: "rgba(251, 191, 36, 0.10)",
                color: "#FCD34D",
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

      {/* ── STEP 1: Primary Time Period Switcher (Today's Orders vs Past Week Orders) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
        role="region"
        aria-label="Order Time Period"
      >
        <button
          type="button"
          onClick={() => {
            setTimePeriod("today");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.95rem 1.15rem",
            borderRadius: 14,
            border:
              timePeriod === "today"
                ? "2px solid #059669"
                : "1.5px solid var(--color-border)",
            background: timePeriod === "today" ? "rgba(52, 211, 153, 0.10)" : "var(--color-surface)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: timePeriod === "today" ? "#059669" : "rgba(255, 255, 255, 0.06)",
                color: timePeriod === "today" ? "#FFFFFF" : "#D1D5DB",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={20} />
            </span>
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  color: timePeriod === "today" ? "#6EE7B7" : "var(--color-text)",
                }}
              >
                📅 Today&apos;s Orders (Live)
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--color-text-muted)" }}>
                New Orders ➔ Pending Orders ➔ Completed Orders
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            {todayActionCount > 0 && (
              <span
                style={{
                  padding: "0.24rem 0.6rem",
                  borderRadius: 999,
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                }}
              >
                {todayActionCount} Active
              </span>
            )}
            <span
              style={{
                padding: "0.26rem 0.65rem",
                borderRadius: 999,
                background: timePeriod === "today" ? "rgba(52, 211, 153, 0.16)" : "rgba(255, 255, 255, 0.06)",
                color: timePeriod === "today" ? "#6EE7B7" : "#D1D5DB",
                fontSize: "0.76rem",
                fontWeight: 800,
              }}
            >
              {allTodayOrders.length} Today
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTimePeriod("past_week");
            setSystematicTab("all");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.95rem 1.15rem",
            borderRadius: 14,
            border:
              timePeriod === "past_week"
                ? "2px solid #7C3AED"
                : "1.5px solid var(--color-border)",
            background: timePeriod === "past_week" ? "rgba(167, 139, 250, 0.10)" : "var(--color-surface)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: timePeriod === "past_week" ? "#7C3AED" : "rgba(255, 255, 255, 0.06)",
                color: timePeriod === "past_week" ? "#FFFFFF" : "#D1D5DB",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <History size={20} />
            </span>
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  color: timePeriod === "past_week" ? "#C4B5FD" : "var(--color-text)",
                }}
              >
                🗓️ Past Week / Earlier Orders
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--color-text-muted)" }}>
                {userRole === "owner"
                  ? "Archive history · Admin can Hide or Delete past orders"
                  : "Previous days order history"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span
              style={{
                padding: "0.26rem 0.65rem",
                borderRadius: 999,
                background: timePeriod === "past_week" ? "rgba(167, 139, 250, 0.16)" : "rgba(255, 255, 255, 0.06)",
                color: timePeriod === "past_week" ? "#C4B5FD" : "#D1D5DB",
                fontSize: "0.76rem",
                fontWeight: 800,
              }}
            >
              {visiblePastOrders.length} Past
            </span>
          </div>
        </button>
      </div>

      {/* ── Admin Past Orders Management Bar (Only on Past Week Tab; Today's Orders Protected) ── */}
      {timePeriod === "today" ? (
        <div
          style={{
            padding: "0.55rem 0.95rem",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            marginBottom: "0.95rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
            fontSize: "0.76rem",
            color: "#CBD5E1",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 700 }}>
            <ShieldCheck size={15} color="#059669" />
            Viewing <strong>Today&apos;s Orders ({todayIstKey})</strong> — organized systematically into{" "}
            <strong>New Orders</strong>, <strong>Pending Orders</strong>, and{" "}
            <strong>Completed Orders</strong>.
          </span>
          {userRole === "owner" && (
            <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 600 }}>
              🔒 Today&apos;s live orders are protected from deletion (switch to{" "}
              <strong>Past Week Orders</strong> to hide or delete older records).
            </span>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "0.85rem 1.05rem",
            borderRadius: 12,
            background: "rgba(167, 139, 250, 0.10)",
            border: "1.5px solid #C4B5FD",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#DDD6FE" }}>
              🗓️ Past Week &amp; Earlier Orders Archive ({allPastOrdersRaw.length} total before today)
            </span>
            <span style={{ fontSize: "0.74rem", color: "#C4B5FD" }}>
              {userRole === "owner"
                ? "As Admin (Owner), you can hide or permanently delete past orders here. Today's orders are strictly protected."
                : "Viewing orders placed before today."}
            </span>
            {pastActionFeedback && (
              <span
                style={{
                  marginTop: 4,
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#34D399",
                }}
              >
                {pastActionFeedback}
              </span>
            )}
          </div>

          {userRole === "owner" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
              {hiddenPastOrdersCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHiddenPastOrders((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.4rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #8B5CF6",
                      background: "var(--color-surface-alt)",
                      color: "#C4B5FD",
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    <Eye size={14} />
                    {showHiddenPastOrders
                      ? "Hide Hidden Orders"
                      : `Show Hidden (${hiddenPastOrdersCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnhideAllPastOrders}
                    style={{
                      padding: "0.4rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #10B981",
                      background: "rgba(52, 211, 153, 0.10)",
                      color: "#34D399",
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Unhide All
                  </button>
                </>
              )}

              {visiblePastOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleHideAllPastOrders(visiblePastOrders.map((o) => o.id))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: 8,
                    border: "1px solid #9CA3AF",
                    background: "var(--color-surface-alt)",
                    color: "#D1D5DB",
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <EyeOff size={14} /> Hide All Past Orders
                </button>
              )}

              {allPastOrdersRaw.length > 0 && (
                <button
                  type="button"
                  disabled={bulkDeletingPast}
                  onClick={() => handleBulkDeleteAllPastOrders(allPastOrdersRaw.length)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: 8,
                    border: "none",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  {bulkDeletingPast
                    ? "Deleting…"
                    : `Delete All Past Orders (${allPastOrdersRaw.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: 2 Distinct Sections Switcher (Online Delivery vs Dine-In Table Orders) ── */}
      <div className={styles.sectionSwitcher} role="region" aria-label="Order Sections">
        <button
          type="button"
          className={`${styles.sectionBtn} ${
            section === "online" ? styles.sectionBtnActive : ""
          }`}
          onClick={() => {
            setSection("online");
          }}
        >
          <div className={styles.sectionBtnLeft}>
            <span className={styles.sectionEmoji}>🛵</span>
            <div>
              <span className={styles.sectionTitle}>Online &amp; Delivery Orders</span>
              <span className={styles.sectionDesc}>
                New ➔ Pending (Cooking / Out for Delivery) ➔ Completed (Delivered)
              </span>
            </div>
          </div>
          <div className={styles.sectionCounters}>
            {onlineActionCount > 0 && (
              <span className={styles.sectionAlertBadge}>{onlineActionCount} New</span>
            )}
            <span className={styles.sectionCountBadge}>
              {onlineOrders.length} {timePeriod === "today" ? "Today" : "Past"}
            </span>
          </div>
        </button>

        <button
          type="button"
          className={`${styles.sectionBtn} ${
            section === "dine_in" ? styles.sectionBtnActive : ""
          }`}
          onClick={() => {
            setSection("dine_in");
          }}
        >
          <div className={styles.sectionBtnLeft}>
            <span className={styles.sectionEmoji}>🪑</span>
            <div>
              <span className={styles.sectionTitle}>Dine-In Table Orders (QR)</span>
              <span className={styles.sectionDesc}>
                New ➔ Pending (Accepted / Ready / Final Bill) ➔ Completed (Paid at Counter)
              </span>
            </div>
          </div>
          <div className={styles.sectionCounters}>
            {dineInActionCount > 0 && (
              <span className={styles.sectionAlertBadge}>{dineInActionCount} Action</span>
            )}
            <span className={styles.sectionCountBadge}>
              {dineInOrders.length} {timePeriod === "today" ? "Today" : "Past"}
            </span>
          </div>
        </button>
      </div>

      {/* ── STEP 3: Systematic Status Sub-Tabs (New Orders, Pending Orders, Completed Orders, Rejected, All) ── */}
      <div className={styles.tabs} role="tablist" aria-label="Systematic Order Statuses">
        {SYSTEMATIC_TABS.map((t) => {
          const count = systematicCounts[t.key] ?? 0;
          const isActive = systematicTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => setSystematicTab(t.key)}
              title={section === "dine_in" ? t.dineInDesc : t.onlineDesc}
            >
              <span>{t.label}</span>
              <span
                className={styles.tabBadge}
                style={
                  t.key === "new" && count > 0 && !isActive
                    ? { background: "#DC2626", color: "#FFFFFF" }
                    : undefined
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Order Cards */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyEmoji}>{section === "dine_in" ? "🪑" : "🛵"}</span>
          <p style={{ fontWeight: 700 }}>
            No{" "}
            {systematicTab === "new"
              ? "New"
              : systematicTab === "pending"
              ? "Pending / In-Progress"
              : systematicTab === "completed"
              ? "Completed"
              : systematicTab === "rejected"
              ? "Rejected"
              : ""}{" "}
            {section === "dine_in" ? "Dine-In Table" : "Online Delivery"} orders in{" "}
            {timePeriod === "today" ? "Today's Orders" : "Past Week Orders"}.
          </p>
          {timePeriod === "today" && systematicTab !== "all" && activeSectionOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setSystematicTab("all")}
              style={{
                marginTop: "0.65rem",
                padding: "0.45rem 0.95rem",
                borderRadius: 999,
                border: "1.5px solid var(--color-primary)",
                background: "rgba(251, 191, 36, 0.10)",
                color: "#FCD34D",
                fontSize: "0.78rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              View All {activeSectionOrders.length} Today&apos;s{" "}
              {section === "dine_in" ? "Dine-In" : "Online"} Orders
            </button>
          )}
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filtered.map((order) => {
            const cfg = getStatusBadgeConfig(order);
            const StatusIcon = cfg.icon;
            const nextAction = getNextAction(order, userRole);
            const isUpdating = updating === order.id;
            const payBadge = getPaymentBadge(order);
            const isTodayOrder = isOrderFromTodayIst(order.createdAt, todayIstKey);
            const isHiddenOrder = hiddenOrderIds.includes(order.id);

            return (
              <div
                key={order.id}
                className={`${styles.orderCard} ${
                  order.status === "pending" ||
                  (order.orderType === "dine_in" && order.status === "out_for_delivery")
                    ? styles.orderCardNew
                    : ""
                }`}
                style={isHiddenOrder ? { opacity: 0.68 } : undefined}
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
                            ? "rgba(52, 211, 153, 0.10)"
                            : order.riderId
                            ? "rgba(96, 165, 250, 0.10)"
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
                                ? "#34D399"
                                : order.riderId
                                ? "#93C5FD"
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
                                color: "#60A5FA",
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
                                  background: "var(--color-surface-alt)",
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
                    {isTodayOrder
                      ? new Date(order.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>

                {/* Primary Staff/Chef Action Button */}
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
                      background: "rgba(167, 139, 250, 0.10)",
                      color: "#C4B5FD",
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
                        background: "rgba(167, 139, 250, 0.16)",
                        color: "#DDD6FE",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      🧾 Generate Final Table Bill Now (
                      {paise2rupee(order.sessionTotalPaise || order.totalPaise)})
                    </button>
                  </div>
                )}

                {/* Online Delivery: When Out for Delivery, waiting for customer to click Accept Order */}
                {order.orderType !== "dine_in" && order.status === "out_for_delivery" && (
                  <div
                    style={{
                      padding: "0.75rem 1.25rem",
                      background: "rgba(34, 211, 238, 0.10)",
                      color: "#67E8F9",
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

                {/* Owner-to-Customer Refund Token Verification Portal (for Rejected/Cancelled Paid Orders) */}
                {(order.status === "rejected" || order.status === "cancelled") &&
                  (order.paymentStatus === "paid" || order.paymentStatus === "refunded") && (
                    <div
                      style={{
                        padding: "0.85rem 1rem",
                        background:
                          order.paymentStatus === "refunded" ||
                          order.refundStatus === "processed"
                            ? "rgba(52, 211, 153, 0.10)"
                            : "rgba(251, 191, 36, 0.10)",
                        borderTop: "1.5px solid #F59E0B",
                        fontSize: "0.78rem",
                      }}
                    >
                      {order.paymentStatus === "refunded" ||
                      order.refundStatus === "processed" ? (
                        <div style={{ color: "#6EE7B7", fontWeight: 800 }}>
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
                            <strong style={{ color: "#FCD34D" }}>
                              🔐 Owner Refund Verification ({paise2rupee(order.totalPaise)})
                            </strong>
                            {order.refundToken ? (
                              <span
                                style={{
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: 6,
                                  background: "rgba(251, 191, 36, 0.16)",
                                  border: "1px solid #D97706",
                                  color: "#FBBF24",
                                  fontWeight: 800,
                                  fontFamily: "monospace",
                                }}
                              >
                                Customer Token: {order.refundToken}
                              </span>
                            ) : (
                              <span style={{ color: "#FBBF24", fontSize: "0.72rem" }}>
                                Waiting for customer to generate Refund Token…
                              </span>
                            )}
                          </div>
                          {order.refundNote && (
                            <div style={{ color: "#FCD34D", fontSize: "0.74rem" }}>
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
                                  background: "var(--color-surface-alt)",
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
                        <div style={{ color: "#FCD34D", fontWeight: 700 }}>
                          🔒 Online Paid Order Rejected — Only the Restaurant Owner (Admin) can
                          verify the customer&apos;s Refund Token and process this refund.
                        </div>
                      )}
                    </div>
                  )}

                {/* ── Admin Hide / Delete Controls for Past Orders ONLY (Never on Today's Orders) ── */}
                {!isTodayOrder && userRole === "owner" && (
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      background: "rgba(255, 255, 255, 0.06)",
                      borderTop: "1px solid var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8", fontWeight: 700 }}>
                      🗓️ Past Order ({getIstDateKey(order.createdAt)})
                    </span>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleHidePastOrder(order.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.28rem 0.6rem",
                          borderRadius: 6,
                          border: "1px solid rgba(255, 255, 255, 0.14)",
                          background: "var(--color-surface-alt)",
                          color: "#E2E8F0",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isHiddenOrder ? <Eye size={12} /> : <EyeOff size={12} />}
                        {isHiddenOrder ? "Unhide" : "Hide"}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleDeletePastOrder(order)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.28rem 0.6rem",
                          borderRadius: 6,
                          border: "1px solid rgba(248, 113, 113, 0.35)",
                          background: "rgba(248, 113, 113, 0.10)",
                          color: "#DC2626",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
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
