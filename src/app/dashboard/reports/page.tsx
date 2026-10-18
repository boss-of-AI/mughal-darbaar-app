import type { Metadata } from "next";
import { count, eq, ne, sum } from "drizzle-orm";
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

  try {
    const [totals, byMode] = await Promise.all([
      db
        .select({
          cnt: count(),
          sub: sum(orders.subtotalPaise),
          tax: sum(orders.taxPaise),
          del: sum(orders.deliveryFeePaise),
          rev: sum(orders.totalPaise),
        })
        .from(orders)
        .where(ne(orders.status, "cancelled")),
      db
        .select({
          mode: orders.serviceMode,
          cnt: count(),
          rev: sum(orders.totalPaise),
        })
        .from(orders)
        .where(eq(orders.status, "delivered"))
        .groupBy(orders.serviceMode),
    ]);

    totalOrders = totals[0]?.cnt ?? 0;
    grossSubtotalPaise = Number(totals[0]?.sub ?? 0);
    totalGstPaise = Number(totals[0]?.tax ?? 0);
    totalDeliveryFeePaise = Number(totals[0]?.del ?? 0);
    totalRevenuePaise = Number(totals[0]?.rev ?? 0);

    modeBreakdown = byMode.map((row) => ({
      mode: row.mode,
      cnt: row.cnt,
      revPaise: Number(row.rev ?? 0),
    }));
  } catch {
    // DB not connected yet
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sales &amp; GST Reports</h1>
        <p className={styles.subtitle}>
          Summary of non-cancelled orders, GST collected, and revenue by ordering mode.
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

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Completed Orders by Mode</h2>
        {modeBreakdown.length === 0 ? (
          <p className={styles.empty}>No completed orders recorded yet.</p>
        ) : (
          <div className={styles.modeList}>
            {modeBreakdown.map((m) => (
              <div key={m.mode} className={styles.modeRow}>
                <span className={styles.modeName}>{m.mode.replace("_", "-")}</span>
                <span>{m.cnt} orders</span>
                <span className={styles.modeRev}>{rupees(m.revPaise)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
