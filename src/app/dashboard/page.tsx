import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, menuItems } from "@/lib/db/schema";
import { eq, gte, sql, count } from "drizzle-orm";
import { restaurantConfig } from "@/config/restaurant.config";
import { getTodayIstStart } from "@/lib/store-hours";
import {
  ShoppingBag, IndianRupee, TrendingUp, Clock, ChevronRight
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: `Dashboard — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

// Helpers
const paise2rupee = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

function greeting(name?: string | null) {
  const istHour =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    ) % 24;
  const t = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  return `${t}${name ? `, ${name.split(" ")[0]}` : ""}!`;
}

export default async function DashboardPage() {
  const session = await auth();

  // Stats with graceful fallback
  let todayOrders = 0;
  let todayRevenuePaise = 0;
  let pendingOrders = 0;
  let recentOrders: {
    id: string;
    displayId: string;
    customerName: string | null;
    totalPaise: number;
    status: string;
    orderType: string;
    paymentStatus: string;
    paymentMethod: string | null;
    createdAt: Date;
  }[] = [];
  let totalMenuItems = 0;

  try {
    const todayStart = getTodayIstStart();

    const [todayRows, pendingCount, recent, menuCount] = await Promise.all([
      db
        .select({
          totalPaise: orders.totalPaise,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          paymentStatus: orders.paymentStatus,
        })
        .from(orders)
        .where(gte(orders.createdAt, todayStart)),
      db
        .select({ cnt: count() })
        .from(orders)
        .where(eq(orders.status, "pending")),
      db
        .select({
          id: orders.id,
          displayId: orders.orderNumber,
          customerName: orders.guestName,
          totalPaise: orders.totalPaise,
          status: orders.status,
          orderType: orders.serviceMode,
          paymentStatus: orders.paymentStatus,
          paymentMethod: orders.paymentMethod,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(sql`${orders.createdAt} DESC`)
        .limit(5),
      db.select({ cnt: count() }).from(menuItems).where(eq(menuItems.status, "available")),
    ]);

    const validToday = todayRows.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.status !== "rejected" &&
        o.paymentStatus !== "refunded" &&
        !(o.paymentMethod === "razorpay" && o.paymentStatus === "pending")
    );

    todayOrders = validToday.length;
    todayRevenuePaise = validToday.reduce((s, o) => s + o.totalPaise, 0);
    pendingOrders = pendingCount[0]?.cnt ?? 0;
    recentOrders = recent;
    totalMenuItems = menuCount[0]?.cnt ?? 0;
  } catch {
    // DB not connected — show empty state
  }

  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: ShoppingBag, color: "primary", link: "/dashboard/orders" },
    { label: "Today's Revenue", value: paise2rupee(todayRevenuePaise), icon: IndianRupee, color: "gold", link: "/dashboard/reports" },
    { label: "Pending Orders", value: pendingOrders, icon: Clock, color: "orange", link: "/dashboard/orders" },
    { label: "Active Menu Items", value: totalMenuItems, icon: TrendingUp, color: "green", link: "/dashboard/menu" },
  ];

  const statusColors: Record<string, string> = {
    pending: "#F59E0B",
    confirmed: "#3B82F6",
    preparing: "#3B82F6",
    ready: "#3B82F6",
    out_for_delivery: "#0891B2",
    delivered: "#059669",
    cancelled: "#EF4444",
    rejected: "#DC2626",
  };

  const statusLabels: Record<string, string> = {
    pending: "To Accept",
    confirmed: "Order Placed",
    preparing: "Order Placed",
    ready: "Order Placed",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{greeting(session?.user?.name)}</h1>
          <p className={styles.pageSubtitle}>
            Here&apos;s what&apos;s happening at {restaurantConfig.name} today.
          </p>
        </div>
        <Link href="/dashboard/orders" className={`btn btn--primary btn--sm ${styles.viewOrdersBtn}`}>
          <ShoppingBag size={16} /> View All Orders
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <Link key={s.label} href={s.link} className={`${styles.statCard} ${styles[`statCard--${s.color}`]}`}>
            <div className={styles.statIcon}><s.icon size={22} /></div>
            <div>
              <p className={styles.statValue}>{s.value}</p>
              <p className={styles.statLabel}>{s.label}</p>
            </div>
            <ChevronRight size={16} className={styles.statArrow} />
          </Link>
        ))}
      </div>

      <div className={styles.mainGrid}>
        {/* Recent Orders */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Orders</h2>
            <Link href="/dashboard/orders" className={styles.cardLink}>View all →</Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyEmoji}>🛒</span>
              <p>No orders yet today</p>
              <p className={styles.emptyHint}>Orders will appear here as they come in</p>
            </div>
          ) : (
            <div className={styles.orderList}>
              {recentOrders.map((order) => {
                const isPaid = order.paymentStatus === "paid";
                const isOnline = order.paymentMethod === "razorpay";
                const isCod = order.paymentMethod === "cash_on_delivery";
                const payBadge = isPaid
                  ? { label: isOnline ? "✓ Paid Online" : "✓ Paid", bg: "rgba(52, 211, 153, 0.16)", color: "#4ADE80" }
                  : isCod
                  ? { label: "COD · Collect", bg: "rgba(251, 191, 36, 0.16)", color: "#FBBF24" }
                  : isOnline
                  ? { label: "Unpaid Online", bg: "rgba(248, 113, 113, 0.16)", color: "#F87171" }
                  : { label: "Counter · Collect", bg: "rgba(96, 165, 250, 0.16)", color: "#93C5FD" };

                return (
                  <Link key={order.id} href="/dashboard/orders" className={styles.orderRow}>
                    <div className={styles.orderInfo}>
                      <span className={styles.orderId}>#{order.displayId}</span>
                      <span className={styles.orderName}>{order.customerName || "Guest"}</span>
                      <span className={styles.orderType}>{order.orderType}</span>
                    </div>
                    <div className={styles.orderRight}>
                      <span className={styles.orderPrice}>{paise2rupee(order.totalPaise)}</span>
                      <span
                        className={styles.orderStatus}
                        style={{ background: payBadge.bg, color: payBadge.color }}
                      >
                        {payBadge.label}
                      </span>
                      <span
                        className={styles.orderStatus}
                        style={{ background: `${statusColors[order.status]}22`, color: statusColors[order.status] }}
                      >
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Quick Actions</h2>
          </div>
          <div className={styles.actionGrid}>
            {[
              { label: "Manage Menu", desc: "Add or edit dishes", href: "/dashboard/menu", emoji: "🍛" },
              { label: "Print QR Codes", desc: "Table QR menus", href: "/dashboard/tables", emoji: "🔲" },
              { label: "View Reports", desc: "Sales analytics", href: "/dashboard/reports", emoji: "📊" },
              { label: "Settings", desc: "GST, hours, branding", href: "/dashboard/settings", emoji: "⚙️" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className={styles.actionCard}>
                <span className={styles.actionEmoji}>{a.emoji}</span>
                <div>
                  <p className={styles.actionLabel}>{a.label}</p>
                  <p className={styles.actionDesc}>{a.desc}</p>
                </div>
                <ChevronRight size={14} className={styles.actionArrow} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
