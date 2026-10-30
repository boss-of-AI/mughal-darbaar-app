import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, paymentRecords } from "@/lib/db/schema";
import { pushOrderEvent } from "@/lib/sse";
import { getIstDateKey } from "@/lib/store-hours";

/**
 * DELETE /api/dashboard/orders/[orderId]
 * Strictly restricted to the Restaurant Owner ("owner").
 * Deletes a past order. Orders placed today (in IST) are protected and cannot be deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Restaurant Owner (Admin) can delete past orders." },
      { status: 403 }
    );
  }

  const { orderId } = await params;

  const [existing] = await db
    .select({ id: orders.id, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const todayIst = getIstDateKey(new Date());
  const orderIst = getIstDateKey(existing.createdAt);

  if (orderIst === todayIst) {
    return NextResponse.json(
      { error: "Today's active/current orders cannot be deleted. You can only delete past orders." },
      { status: 400 }
    );
  }

  await db.delete(paymentRecords).where(eq(paymentRecords.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));

  pushOrderEvent("order_deleted", { id: orderId });

  return NextResponse.json({ ok: true, deletedId: orderId });
}
