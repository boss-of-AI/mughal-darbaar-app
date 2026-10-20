import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import AutoRefresh from "./AutoRefresh";
import AcceptDeliveryButton from "./AcceptDeliveryButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order status", robots: { index: false } };

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

function getStageIndex(status: string): number {
  switch (status) {
    case "pending":
      return 0; // Waiting for chef/staff to accept
    case "confirmed":
    case "preparing":
    case "ready":
      return 1; // Stage 1: Order Placed
    case "out_for_delivery":
      return 2; // Stage 2: Out for Delivery
    case "delivered":
      return 3; // Stage 3: Delivered
    default:
      return -1; // cancelled / rejected
  }
}

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
  const stageIdx = getStageIndex(order.status);
  const isCod = order.paymentMethod === "cash_on_delivery" || order.paymentMethod === "pay_at_counter";

  const stages = [
    { step: 1, label: "Order Placed", emoji: "👨‍🍳" },
    { step: 2, label: "Out for Delivery", emoji: "🛵" },
    { step: 3, label: "Delivered", emoji: "✅" },
  ];

  let bannerText = "";
  let bannerBg = "var(--color-surface)";
  let bannerBorder = "var(--color-border)";
  let bannerColor = "var(--color-text)";

  if (order.status === "pending") {
    bannerText =
      order.paymentMethod === "razorpay" && order.paymentStatus === "paid"
        ? "Payment Successful (Paid Online ✅) — Waiting for chef/staff to accept your order…"
        : "Order Confirmed (Cash on Delivery) — Waiting for chef/staff to accept your order…";
    bannerBg = "#FFFBEB";
    bannerBorder = "#F59E0B";
    bannerColor = "#92400E";
  } else if (stageIdx === 1) {
    bannerText = "Order Placed! 👨‍🍳 Our chef has accepted your order and is preparing it fresh.";
    bannerBg = "#EFF6FF";
    bannerBorder = "#3B82F6";
    bannerColor = "#1E40AF";
  } else if (stageIdx === 2) {
    bannerText = "Out for Delivery! 🛵 Your order is on the way to your location.";
    bannerBg = "#ECFEFF";
    bannerBorder = "#06B6D4";
    bannerColor = "#0E7490";
  } else if (stageIdx === 3) {
    bannerText = "Delivered! ✅ Thank you for ordering with us. Enjoy your meal!";
    bannerBg = "#ECFDF5";
    bannerBorder = "#10B981";
    bannerColor = "#065F46";
  } else if (order.status === "rejected") {
    bannerText = "Sorry — the restaurant couldn't accept this order.";
    bannerBg = "#FEF2F2";
    bannerBorder = "#EF4444";
    bannerColor = "#991B1B";
  } else if (order.status === "cancelled") {
    bannerText = "This order was cancelled.";
    bannerBg = "#FEF2F2";
    bannerBorder = "#EF4444";
    bannerColor = "#991B1B";
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "6rem 1rem 4rem" }}>
      {!done && <AutoRefresh />}

      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-2xl)" }}>
        Thank you, {order.guestName}!
      </h1>
      <p style={{ margin: "0.4rem 0 1.25rem", color: "var(--color-text-muted)" }}>
        Order <strong>{order.orderNumber}</strong> · {order.serviceMode.replace("_", "-")}
      </p>

      {/* Status Banner */}
      <div
        role="status"
        style={{
          padding: "1rem 1.25rem",
          borderRadius: 12,
          background: bannerBg,
          border: `1.5px solid ${bannerBorder}`,
          color: bannerColor,
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        {bannerText}
      </div>

      {/* 3-Stage Order Progress Stepper: Order Placed -> Out for Delivery -> Delivered */}
      {stageIdx >= 0 && (
        <div
          aria-label="Order progress"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {stages.map((s) => {
            const isCompleted = stageIdx > s.step || stageIdx === 3;
            const isCurrent = stageIdx === s.step && stageIdx < 3;
            const active = isCompleted || isCurrent;

            return (
              <div
                key={s.step}
                style={{
                  padding: "0.85rem 0.5rem",
                  borderRadius: 12,
                  textAlign: "center",
                  background: isCompleted
                    ? "#DCFCE7"
                    : isCurrent
                    ? "#DBEAFE"
                    : "var(--color-surface)",
                  border: isCompleted
                    ? "2px solid #16A34A"
                    : isCurrent
                    ? "2px solid #2563EB"
                    : "1px solid var(--color-border)",
                  color: isCompleted
                    ? "#15803D"
                    : isCurrent
                    ? "#1D4ED8"
                    : "var(--color-text-light)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
                  {isCompleted ? "✓" : s.emoji}
                </div>
                <div style={{ fontSize: "0.8rem", fontWeight: active ? 700 : 500 }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer "Accept Order" Button when Out for Delivery */}
      {order.status === "out_for_delivery" && (
        <AcceptDeliveryButton
          orderId={order.id}
          isCod={isCod && order.paymentStatus !== "paid"}
          amountFormatted={rupees(order.totalPaise)}
        />
      )}

      {/* Order Summary Card */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: 12,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Order Summary
        </h2>
        {items.map((i) => (
          <div
            key={i.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.3rem 0",
              fontSize: "0.92rem",
            }}
          >
            <span>
              <strong>{i.quantity}×</strong> {i.name}
              {i.variantName ? ` (${i.variantName})` : ""}
            </span>
            <span>{rupees(i.totalPaise)}</span>
          </div>
        ))}
        <hr style={{ margin: "0.85rem 0", borderColor: "var(--color-border)" }} />
        <Row k="Subtotal" v={rupees(order.subtotalPaise)} />
        {order.deliveryFeePaise > 0 && <Row k="Delivery" v={rupees(order.deliveryFeePaise)} />}
        <Row k={`GST (${Number(order.gstRatePct)}%)`} v={rupees(order.taxPaise)} />
        <Row k="Total" v={rupees(order.totalPaise)} bold />

        <div
          style={{
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px dashed var(--color-border)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: order.paymentStatus === "paid" ? "#047857" : "#B45309",
          }}
        >
          {order.paymentMethod === "razorpay"
            ? order.paymentStatus === "paid"
              ? "💳 Paid Online via Razorpay ✅"
              : "⏳ Online payment pending"
            : order.paymentStatus === "paid"
            ? "💵 Paid in Cash ✅"
            : order.paymentMethod === "cash_on_delivery"
            ? `💵 Cash on Delivery — Please pay ${rupees(order.totalPaise)} on arrival`
            : `🏪 Pay at Counter — ${rupees(order.totalPaise)}`}
        </div>
      </div>
    </main>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0.2rem 0",
        fontWeight: bold ? 700 : 400,
        fontSize: bold ? "1.05rem" : "0.9rem",
      }}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
