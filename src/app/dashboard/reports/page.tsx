import type { Metadata } from "next";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./reports.module.css";

export const metadata: Metadata = { title: `Reports — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function DashboardReportsPage() {
  let totalOrders = 0;
  let grossSubtotalPaise = 0;
  let totalGstPaise = 0;
  let totalDeliveryFeePaise = 0;
  let totalRevenuePaise = 0;
  let modeBreakdown: { mode: string; cnt: number; revPaise: number }[] = [];
  let paymentBreakdown: { label: string; cnt: number; revPaise: number }[] = [];

  try {
    const allOrders = await db.select().from(orders);

    // Exclude cancelled, rejected, or abandoned unpaid online checkout drafts
    const validOrders = allOrders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.status !== "rejected" &&
        !(o.paymentMethod === "razorpay" && o.paymentStatus === "pending")
    );

    totalOrders = validOrders.length;
    for (const o of validOrders) {
      grossSubtotalPaise += o.subtotalPaise;
      totalGstPaise += o.taxPaise;
      totalDeliveryFeePaise += o.deliveryFeePaise;
      totalRevenuePaise += o.totalPaise;
    }

    const byModeMap = new Map<string, { cnt: number; revPaise: number }>();
    for (const o of validOrders) {
      const cur = byModeMap.get(o.serviceMode) ?? { cnt: 0, revPaise: 0 };
      cur.cnt += 1;
      cur.revPaise += o.totalPaise;
      byModeMap.set(o.serviceMode, cur);
    }
    modeBreakdown = Array.from(byModeMap.entries()).map(([mode, v]) => ({
      mode,
      cnt: v.cnt,
      revPaise: v.revPaise,
    }));

    const paidOnline = validOrders.filter(
      (o) => o.paymentMethod === "razorpay" && o.paymentStatus === "paid"
    );
    const paidCash = validOrders.filter(
      (o) => o.paymentMethod !== "razorpay" && o.paymentStatus === "paid"
    );
    const pendingCash = validOrders.filter(
      (o) => o.paymentStatus !== "paid"
    );

    paymentBreakdown = [
      {
        label: "💳 Paid Online (Razorpay)",
        cnt: paidOnline.length,
        revPaise: paidOnline.reduce((s, o) => s + o.totalPaise, 0),
      },
      {
        label: "💵 Paid in Cash (COD / Counter)",
        cnt: paidCash.length,
        revPaise: paidCash.reduce((s, o) => s + o.totalPaise, 0),
      },
      {
        label: "⏳ Pending Collection (Active COD / Counter)",
        cnt: pendingCash.length,
        revPaise: pendingCash.reduce((s, o) => s + o.totalPaise, 0),
      },
    ];
  } catch {
    // DB not connected yet
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sales &amp; GST Reports</h1>
        <p className={styles.subtitle}>
          Summary of valid orders, GST collected, ordering modes, and Online vs. Cash payments.
        </p>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Orders</span>
          <span className={styles.kpiValue}>{totalOrders}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Net Food Subtotal</span>
          <span className={styles.kpiValue}>{rupees(grossSubtotalPaise)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>GST Collected</span>
          <span className={styles.kpiValue}>{rupees(totalGstPaise)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Delivery Fees</span>
          <span className={styles.kpiValue}>{rupees(totalDeliveryFeePaise)}</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiHighlight}`}>
          <span className={styles.kpiLabel}>Total Billed Revenue</span>
          <span className={styles.kpiValue}>{rupees(totalRevenuePaise)}</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Payment Breakdown (Online vs. Cash)</h2>
          <div className={styles.modeList}>
            {paymentBreakdown.map((p) => (
              <div key={p.label} className={styles.modeRow}>
                <span className={styles.modeName}>{p.label}</span>
                <span>{p.cnt} order{p.cnt !== 1 ? "s" : ""}</span>
                <span className={styles.modeRev}>{rupees(p.revPaise)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Orders by Service Mode</h2>
          {modeBreakdown.length === 0 ? (
            <p className={styles.empty}>No orders recorded yet.</p>
          ) : (
            <div className={styles.modeList}>
              {modeBreakdown.map((m) => (
                <div key={m.mode} className={styles.modeRow}>
                  <span className={styles.modeName}>{m.mode.replace("_", "-")}</span>
                  <span>{m.cnt} order{m.cnt !== 1 ? "s" : ""}</span>
                  <span className={styles.modeRev}>{rupees(m.revPaise)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
