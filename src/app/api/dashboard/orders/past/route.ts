import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, paymentRecords } from "@/lib/db/schema";
import { getIstDateKey } from "@/lib/store-hours";
import { pushOrderEvent } from "@/lib/sse";

/**
 * DELETE /api/dashboard/orders/past
 * Strictly restricted to the Restaurant Owner ("owner").
 * Deletes all past orders (orders created before today in IST), keeping all of today's orders intact.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Restaurant Owner (Admin) can delete past orders." },
      { status: 403 }
    );
  }

  const allOrders = await db
    .select({ id: orders.id, createdAt: orders.createdAt })
    .from(orders);

  const todayIst = getIstDateKey(new Date());
  const pastOrderIds = allOrders
    .filter((o) => getIstDateKey(o.createdAt) !== todayIst)
    .map((o) => o.id);

  if (pastOrderIds.length === 0) {
    return NextResponse.json({ ok: true, deletedCount: 0, deletedIds: [] });
  }

  await db
    .delete(paymentRecords)
    .where(inArray(paymentRecords.orderId, pastOrderIds));
  await db.delete(orders).where(inArray(orders.id, pastOrderIds));

  pushOrderEvent("orders_bulk_deleted", { ids: pastOrderIds });

  return NextResponse.json({
    ok: true,
    deletedCount: pastOrderIds.length,
    deletedIds: pastOrderIds,
  });
}
