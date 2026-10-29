import { notFound } from "next/navigation";
import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, restaurantTables, tableSessions } from "@/lib/db/schema";
import AutoRefresh from "./AutoRefresh";
import AcceptDeliveryButton from "./AcceptDeliveryButton";
import GenerateBillButton from "./GenerateBillButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order status", robots: { index: false } };

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

function getOnlineStageIndex(status: string): number {
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

function getDineInStageIndex(status: string): number {
  switch (status) {
    case "pending":
      return 0; // Waiting for staff to accept
    case "confirmed":
    case "preparing":
      return 1; // Stage 1: Order Accepted
    case "ready":
      return 2; // Stage 2: Order Is Ready
    case "out_for_delivery":
      return 3; // Stage 3: Final Bill Generated (Pay at Counter)
    case "delivered":
      return 4; // Stage 4: Paid at Counter
    default:
      return -1; // cancelled / rejected
  }
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let order: typeof orders.$inferSelect | undefined;
  let items: (typeof orderItems.$inferSelect)[] = [];
  let tableName: string | null = null;
  let sessionOrders: (typeof orders.$inferSelect)[] = [];
  let sessionItems: (typeof orderItems.$inferSelect)[] = [];
  let billGenerated = false;

  try {
    [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (order) {
      items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

      if (order.tableId) {
        const [tbl] = await db
          .select({ name: restaurantTables.name })
          .from(restaurantTables)
          .where(eq(restaurantTables.id, order.tableId))
          .limit(1);
        tableName = tbl?.name ?? null;
      }

      if (order.serviceMode === "dine_in" && order.tableSessionId) {
        const allSessOrders = await db
          .select()
          .from(orders)
          .where(eq(orders.tableSessionId, order.tableSessionId))
          .orderBy(asc(orders.createdAt));

        sessionOrders = allSessOrders.filter(
          (so) => so.status !== "cancelled" && so.status !== "rejected"
        );

        const sessOrderIds = sessionOrders.map((so) => so.id);
        if (sessOrderIds.length > 0) {
          sessionItems = await db
            .select()
            .from(orderItems)
            .where(inArray(orderItems.orderId, sessOrderIds));
        }

        const [sess] = await db
          .select()
          .from(tableSessions)
          .where(eq(tableSessions.id, order.tableSessionId))
          .limit(1);

        billGenerated =
          sess?.notes === "bill_generated" ||
          sess?.status === "closed" ||
          sessionOrders.some(
            (so) => so.status === "out_for_delivery" || so.status === "delivered"
          );
      } else if (order.serviceMode === "dine_in") {
        sessionOrders = [order];
        sessionItems = items;
        billGenerated = order.status === "out_for_delivery" || order.status === "delivered";
      }
    }
  } catch {
    notFound();
  }
  if (!order) notFound();

  const isDineIn = order.serviceMode === "dine_in";
  const done = ["delivered", "cancelled", "rejected"].includes(order.status);
  const isCod =
    order.paymentMethod === "cash_on_delivery" || order.paymentMethod === "pay_at_counter";

  // Combined totals across all rounds in the same Dine-In table session
  const combinedSubtotalPaise =
    isDineIn && sessionOrders.length > 0
      ? sessionOrders.reduce((s, o) => s + o.subtotalPaise, 0)
      : order.subtotalPaise;
  const combinedDiscountPaise =
    isDineIn && sessionOrders.length > 0
      ? sessionOrders.reduce((s, o) => s + (o.discountPaise ?? 0), 0)
      : order.discountPaise ?? 0;
  const combinedTaxPaise =
    isDineIn && sessionOrders.length > 0
      ? sessionOrders.reduce((s, o) => s + o.taxPaise, 0)
      : order.taxPaise;
  const combinedTotalPaise =
    isDineIn && sessionOrders.length > 0
      ? sessionOrders.reduce((s, o) => s + o.totalPaise, 0)
      : order.totalPaise;

  const isSessionPaid =
    order.paymentStatus === "paid" ||
    (isDineIn &&
      sessionOrders.length > 0 &&
      sessionOrders.every((so) => so.paymentStatus === "paid" || so.status === "delivered"));

  const stageIdx = isDineIn
    ? isSessionPaid
      ? 4
      : billGenerated
      ? 3
      : getDineInStageIndex(order.status)
    : getOnlineStageIndex(order.status);

  const onlineStages = [
    { step: 1, label: "Order Placed", emoji: "👨‍🍳" },
    { step: 2, label: "Out for Delivery", emoji: "🛵" },
    { step: 3, label: "Delivered", emoji: "✅" },
  ];

  const dineInStages = [
    { step: 1, label: "Order Accepted", emoji: "👨‍🍳" },
    { step: 2, label: "Order Is Ready", emoji: "🍽️" },
    { step: 3, label: "Final Bill Generated", emoji: "🧾" },
    { step: 4, label: "Paid at Counter", emoji: "✅" },
  ];

  const activeStages = isDineIn ? dineInStages : onlineStages;
  const finalStep = isDineIn ? 4 : 3;

  let bannerText = "";
  let bannerBg = "var(--color-surface)";
  let bannerBorder = "var(--color-border)";
  let bannerColor = "var(--color-text)";

  if (order.status === "rejected") {
    bannerText = "Sorry — the restaurant couldn't accept this order.";
    bannerBg = "#FEF2F2";
    bannerBorder = "#EF4444";
    bannerColor = "#991B1B";
  } else if (order.status === "cancelled") {
    bannerText = "This order was cancelled.";
    bannerBg = "#FEF2F2";
    bannerBorder = "#EF4444";
    bannerColor = "#991B1B";
  } else if (isDineIn) {
    if (stageIdx === 0) {
      bannerText = `Order Sent to Kitchen (${tableName || "Dine-In"}) — Waiting for staff to accept your order…`;
      bannerBg = "#FFFBEB";
      bannerBorder = "#F59E0B";
      bannerColor = "#92400E";
    } else if (stageIdx === 1) {
      bannerText =
        "Order Accepted! 👨‍🍳 Our kitchen is preparing your dishes fresh for your table.";
      bannerBg = "#EFF6FF";
      bannerBorder = "#3B82F6";
      bannerColor = "#1E40AF";
    } else if (stageIdx === 2) {
      bannerText =
        "Order Is Ready! 🍽️ Enjoy your meal! You can order more items anytime, or tap 'Generate Final Total Bill' when you finish.";
      bannerBg = "#F5F3FF";
      bannerBorder = "#8B5CF6";
      bannerColor = "#5B21B6";
    } else if (stageIdx === 3) {
      bannerText = `🧾 Final Total Bill Generated (${rupees(
        combinedTotalPaise
      )}) — Please show this bill and pay at the counter.`;
      bannerBg = "#FFFBEB";
      bannerBorder = "#D97706";
      bannerColor = "#92400E";
    } else if (stageIdx === 4) {
      bannerText =
        "✅ Bill Paid at Counter! Thank you for dining at Mughal Darbaar. We hope to see you again soon!";
      bannerBg = "#ECFDF5";
      bannerBorder = "#10B981";
      bannerColor = "#065F46";
    }
  } else {
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
      if (order.riderReachedAt) {
        bannerText = `📍 Your Rider (${order.riderName || "Delivery Partner"}) has REACHED your location! ${
          isCod && order.paymentStatus !== "paid"
            ? `Please keep ${rupees(order.totalPaise)} in cash ready to hand over.`
            : "Please collect your order at the door."
        }`;
        bannerBg = "#ECFDF5";
        bannerBorder = "#10B981";
        bannerColor = "#065F46";
      } else {
        bannerText = `Out for Delivery! 🛵 ${
          order.riderName
            ? `Rider ${order.riderName} is on the way to your location.`
            : "Your order is on the way to your location."
        }`;
        bannerBg = "#ECFEFF";
        bannerBorder = "#06B6D4";
        bannerColor = "#0E7490";
      }
    } else if (stageIdx === 3) {
      bannerText = "Delivered! ✅ Thank you for ordering with us. Enjoy your meal!";
      bannerBg = "#ECFDF5";
      bannerBorder = "#10B981";
      bannerColor = "#065F46";
    }
  }

  const canGenerateDineInBill =
    isDineIn &&
    !billGenerated &&
    !isSessionPaid &&
    sessionOrders.length > 0 &&
    sessionOrders.every((so) =>
      ["confirmed", "preparing", "ready", "out_for_delivery"].includes(so.status)
    );

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "6rem 1rem 4rem" }}>
      {!done && <AutoRefresh />}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-2xl)" }}>
          Thank you, {order.guestName}!
        </h1>
        {isDineIn && (
          <span
            style={{
              background: "#FEF3C7",
              color: "#92400E",
              border: "1.5px solid #F59E0B",
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: "0.85rem",
              fontWeight: 800,
            }}
          >
            🪑 {tableName || "Dine-In Table"}
          </span>
        )}
      </div>

      <p style={{ margin: "0.4rem 0 1.25rem", color: "var(--color-text-muted)" }}>
        Order <strong>{order.orderNumber}</strong> · {order.serviceMode.replace("_", "-")}
        {isDineIn && sessionOrders.length > 1
          ? ` · Table Session (${sessionOrders.length} Orders)`
          : ""}
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

      {/* Order Progress Stepper */}
      {stageIdx >= 0 && (
        <div
          aria-label="Order progress"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${activeStages.length}, 1fr)`,
            gap: "0.6rem",
            marginBottom: "1.5rem",
          }}
        >
          {activeStages.map((s) => {
            const isCompleted = stageIdx > s.step || stageIdx === finalStep;
            const isCurrent = stageIdx === s.step && stageIdx < finalStep;
            const active = isCompleted || isCurrent;

            return (
              <div
                key={s.step}
                style={{
                  padding: "0.8rem 0.4rem",
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
                <div style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>
                  {isCompleted ? "✓" : s.emoji}
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: active ? 700 : 500 }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned Rider Card (for Delivery Orders) */}
      {!isDineIn && order.riderName && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: 12,
            background: order.riderReachedAt ? "#ECFDF5" : "#EFF6FF",
            border: order.riderReachedAt ? "2px solid #10B981" : "1.5px solid #93C5FD",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                color: order.riderReachedAt ? "#047857" : "#1D4ED8",
              }}
            >
              {order.riderReachedAt
                ? "📍 Rider Has Reached Your Doorstep!"
                : "🛵 Your Allotted Delivery Rider"}
            </span>
            <strong style={{ fontSize: "1.02rem" }}>{order.riderName}</strong>
            {isCod && order.paymentStatus !== "paid" && (
              <span
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  color: "#B45309",
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                💵 Cash on Delivery to pay Rider: {rupees(order.totalPaise)}
              </span>
            )}
          </div>
          {order.riderPhone && (
            <a
              href={`tel:${order.riderPhone}`}
              style={{
                padding: "0.5rem 0.95rem",
                borderRadius: 10,
                background: "#2563EB",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.84rem",
                textDecoration: "none",
              }}
            >
              📞 Call Rider ({order.riderPhone})
            </a>
          )}
        </div>
      )}

      {/* Online Delivery: Customer "Accept Order" Button when Out for Delivery */}
      {!isDineIn && order.status === "out_for_delivery" && (
        <AcceptDeliveryButton
          orderId={order.id}
          isCod={isCod && order.paymentStatus !== "paid"}
          amountFormatted={rupees(order.totalPaise)}
        />
      )}

      {/* Dine-In: Multi-Order & "Generate Final Total Bill" Actions before bill is generated */}
      {isDineIn && !billGenerated && !isSessionPaid && !done && (
        <GenerateBillButton
          orderId={order.id}
          combinedTotalFormatted={rupees(combinedTotalPaise)}
          orderCount={sessionOrders.length}
          canGenerate={canGenerateDineInBill}
        />
      )}

      {/* Dine-In: Combined Final Counter Bill (Shown prominently once generated or paid, or as running bill) */}
      {isDineIn ? (
        <div
          style={{
            padding: "1.4rem",
            borderRadius: 14,
            background: "var(--color-surface)",
            border: billGenerated
              ? isSessionPaid
                ? "2px solid #10B981"
                : "2px solid #D97706"
              : "1px solid var(--color-border)",
            boxShadow: billGenerated ? "0 8px 28px rgba(0,0,0,0.08)" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px dashed var(--color-border)",
              paddingBottom: "0.75rem",
              marginBottom: "0.9rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
                {billGenerated
                  ? "🧾 Final Combined Table Bill"
                  : "🪑 Running Table Bill Summary"}
              </h2>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                {tableName || "Dine-In Table"} · {sessionOrders.length}{" "}
                {sessionOrders.length === 1 ? "Order" : "Orders Combined"}
              </span>
            </div>

            <span
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: "0.78rem",
                fontWeight: 800,
                background: isSessionPaid ? "#D1FAE5" : "#FEF3C7",
                color: isSessionPaid ? "#047857" : "#B45309",
                border: isSessionPaid ? "1px solid #10B981" : "1px solid #F59E0B",
              }}
            >
              {isSessionPaid ? "✅ PAID AT COUNTER" : "⏳ UNPAID · PAY AT COUNTER"}
            </span>
          </div>

          {/* All orders in this table session */}
          {sessionOrders.map((so, idx) => {
            const roundItems = sessionItems.filter((i) => i.orderId === so.id);
            return (
              <div
                key={so.id}
                style={{
                  marginBottom: "0.85rem",
                  paddingBottom: "0.65rem",
                  borderBottom:
                    idx < sessionOrders.length - 1
                      ? "1px dotted var(--color-border)"
                      : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    marginBottom: "0.35rem",
                  }}
                >
                  <span>
                    Round {idx + 1} · #{so.orderNumber}
                  </span>
                  <span>
                    {new Date(so.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {roundItems.map((i) => (
                  <div
                    key={i.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.25rem 0",
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
              </div>
            );
          })}

          <hr style={{ margin: "0.85rem 0", borderColor: "var(--color-border)" }} />
          <Row k="Combined Subtotal" v={rupees(combinedSubtotalPaise)} />
          {combinedDiscountPaise > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.2rem 0",
                fontSize: "0.9rem",
                color: "#059669",
                fontWeight: 700,
              }}
            >
              <span>🏷️ Offer / Coupon Discount</span>
              <span>-{rupees(combinedDiscountPaise)}</span>
            </div>
          )}
          <Row k={`GST (${Number(order.gstRatePct)}%)`} v={rupees(combinedTaxPaise)} />
          <Row k="Grand Total (Pay at Counter)" v={rupees(combinedTotalPaise)} bold />

          <div
            style={{
              marginTop: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: 10,
              background: isSessionPaid ? "#ECFDF5" : "#FFFBEB",
              border: isSessionPaid ? "1px solid #A7F3D0" : "1px solid #FDE68A",
              fontSize: "0.92rem",
              fontWeight: 700,
              color: isSessionPaid ? "#047857" : "#92400E",
              textAlign: "center",
            }}
          >
            {isSessionPaid
              ? `✅ Paid ${rupees(combinedTotalPaise)} at Counter — Thank you for dining with us!`
              : billGenerated
              ? `🏪 Please pay ${rupees(combinedTotalPaise)} in Cash at the Counter. Staff will mark your bill as Paid once received.`
              : `🏪 Running Table Total: ${rupees(combinedTotalPaise)} — Pay at Counter after generating final bill`}
          </div>
        </div>
      ) : (
        /* Online / Delivery Order Summary Card */
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
          {order.discountPaise > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.2rem 0",
                fontSize: "0.9rem",
                color: "#059669",
                fontWeight: 700,
              }}
            >
              <span>🏷️ Offer Discount</span>
              <span>-{rupees(order.discountPaise)}</span>
            </div>
          )}
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
      )}
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
