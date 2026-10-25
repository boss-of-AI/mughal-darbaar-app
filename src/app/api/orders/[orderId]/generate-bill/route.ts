import { NextRequest, NextResponse } from "next/server";
import { eq, and, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, tableSessions } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.serviceMode !== "dine_in") {
      return NextResponse.json({ error: "Only dine-in orders can generate a table bill" }, { status: 400 });
    }

    const now = new Date();

    if (order.tableSessionId) {
      await db
        .update(tableSessions)
        .set({ notes: "bill_generated" })
        .where(eq(tableSessions.id, order.tableSessionId));

      const sessionOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.tableSessionId, order.tableSessionId),
            notInArray(orders.status, ["cancelled", "rejected", "delivered"])
          )
        );

      await db
        .update(orders)
        .set({ status: "out_for_delivery", updatedAt: now })
        .where(
          and(
            eq(orders.tableSessionId, order.tableSessionId),
            notInArray(orders.status, ["cancelled", "rejected", "delivered"])
          )
        );

      for (const so of sessionOrders) {
        const payload = await buildDashboardOrderPayload(so.id);
        if (payload) {
          pushOrderEvent("order_updated", payload);
        }
      }

      const mainPayload = await buildDashboardOrderPayload(order.id);
      if (mainPayload) {
        pushOrderEvent("bill_generated", mainPayload);
      }

      return NextResponse.json({ ok: true, order: mainPayload });
    } else {
      await db
        .update(orders)
        .set({ status: "out_for_delivery", updatedAt: now })
        .where(eq(orders.id, orderId));

      const payload = await buildDashboardOrderPayload(orderId);
      if (payload) {
        pushOrderEvent("order_updated", payload);
        pushOrderEvent("bill_generated", payload);
      }

      return NextResponse.json({ ok: true, order: payload });
    }
  } catch (err) {
    console.error("[POST /api/orders/[orderId]/generate-bill]", err);
    return NextResponse.json({ error: "Failed to generate bill" }, { status: 500 });
  }
}
