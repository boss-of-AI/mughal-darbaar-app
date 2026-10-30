import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * POST /api/orders/[orderId]/deliver
 * Called by the customer on the order tracking page when they click "Accept Order"
 * upon receiving their delivery. Marks the order as delivered (and paid if COD/counter)
 * and broadcasts the update in real time to the Admin/Chef Live Orders board.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (existing.status === "cancelled" || existing.status === "rejected") {
    return NextResponse.json(
      { error: "This order cannot be marked as delivered" },
      { status: 400 }
    );
  }

  const now = new Date();
  const nextPaymentStatus =
    existing.paymentStatus === "refunded"
      ? "refunded"
      : existing.paymentMethod === "cash_on_delivery" ||
        existing.paymentMethod === "pay_at_counter" ||
        existing.paymentStatus === "paid"
      ? "paid"
      : existing.paymentStatus;

  await db
    .update(orders)
    .set({
      status: "delivered",
      paymentStatus: nextPaymentStatus,
      deliveredAt: now,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  const payload = await buildDashboardOrderPayload(orderId);
  if (payload) {
    pushOrderEvent("order_updated", payload);
  }

  return NextResponse.json({ ok: true, status: "delivered", paymentStatus: nextPaymentStatus });
}
