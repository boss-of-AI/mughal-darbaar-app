import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order status", robots: { index: false } };

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const labels: Record<string, string> = {
  pending: "Order received — waiting for the restaurant to confirm",
  confirmed: "Confirmed",
  preparing: "Being prepared 👨‍🍳",
  ready: "Ready!",
  out_for_delivery: "Out for delivery 🛵",
  delivered: "Completed ✅",
  cancelled: "Cancelled",
  rejected: "Sorry — the restaurant couldn't accept this order",
};

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let order: typeof orders.$inferSelect | undefined;
  let items: (typeof orderItems.$inferSelect)[] = [];
  try {
    [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (order) {
      items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    }
  } catch {
    notFound();
  }
  if (!order) notFound();
  const done = ["delivered", "cancelled", "rejected"].includes(order.status);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "6rem 1rem 4rem" }}>
      {!done && <AutoRefresh />}
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-2xl)" }}>Thank you, {order.guestName}!</h1>
      <p style={{ margin: "0.5rem 0 1.5rem" }}>
        Order <strong>{order.orderNumber}</strong> · {order.serviceMode.replace("_", "-")}
      </p>
      <div style={{ padding: "1rem", borderRadius: 12, background: "var(--color-surface)", border: "1px solid var(--color-border)", marginBottom: "1.5rem" }} role="status">
        {labels[order.status] ?? order.status}
      </div>
      {items.map((i) => (
        <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0" }}>
          <span>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ""}</span>
          <span>{rupees(i.totalPaise)}</span>
        </div>
      ))}
      <hr style={{ margin: "1rem 0" }} />
      <Row k="Subtotal" v={rupees(order.subtotalPaise)} />
      {order.deliveryFeePaise > 0 && <Row k="Delivery" v={rupees(order.deliveryFeePaise)} />}
      <Row k={`GST (${Number(order.gstRatePct)}%)`} v={rupees(order.taxPaise)} />
      <Row k="Total" v={rupees(order.totalPaise)} bold />
      <p style={{ marginTop: "1rem", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        {order.paymentMethod === "razorpay"
          ? order.paymentStatus === "paid"
            ? "Paid online via Razorpay ✅"
            : "Online payment pending"
          : order.paymentMethod === "cash_on_delivery"
          ? "Pay cash on delivery."
          : "Pay at the counter."}
      </p>
    </main>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 700 : 400 }}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
