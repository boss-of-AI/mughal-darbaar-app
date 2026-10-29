import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, tableSessions, users } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { z } from "zod";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const statusSchema = z
  .object({
    status: z
      .enum([
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
      ])
      .optional(),
    paymentStatus: z
      .enum(["pending", "paid", "failed", "refunded", "pay_at_counter"])
      .optional(),
    riderId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => Boolean(d.status || d.paymentStatus || d.riderId !== undefined), {
    message: "Provide status, paymentStatus, or riderId",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff", "rider"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { status, paymentStatus, riderId } = parsed.data;
  const now = new Date();

  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updates: Partial<typeof orders.$inferInsert> = { updatedAt: now };

  if (riderId !== undefined) {
    if (riderId === null) {
      updates.riderId = null;
      updates.riderName = null;
      updates.riderPhone = null;
    } else {
      const [rider] = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, riderId))
        .limit(1);
      if (rider) {
        updates.riderId = rider.id;
        updates.riderName = rider.name ?? "Delivery Rider";
        updates.riderPhone = rider.phone ?? null;
      }
    }
  }

  if (status) {
    updates.status = status;
    if (status === "confirmed") updates.acceptedAt = now;
    if (status === "ready") updates.readyAt = now;
    if (status === "delivered") updates.deliveredAt = now;
    if (status === "cancelled" || status === "rejected") updates.cancelledAt = now;
  }

  if (paymentStatus) {
    updates.paymentStatus = paymentStatus;
    if (existing.serviceMode === "dine_in" && paymentStatus === "paid") {
      updates.status = "delivered";
      updates.deliveredAt = now;
    }
  }

  // If this is a Dine-In order being marked Paid / Completed at Counter, settle all orders in the same tableSessionId
  if (
    existing.serviceMode === "dine_in" &&
    existing.tableSessionId &&
    (paymentStatus === "paid" || status === "delivered")
  ) {
    await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        status: "delivered",
        deliveredAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(orders.tableSessionId, existing.tableSessionId),
          notInArray(orders.status, ["cancelled", "rejected"])
        )
      );

    await db
      .update(tableSessions)
      .set({ status: "closed", closedAt: now, notes: "paid_and_closed" })
      .where(eq(tableSessions.id, existing.tableSessionId));

    const sessionOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.tableSessionId, existing.tableSessionId));

    for (const so of sessionOrders) {
      const p = await buildDashboardOrderPayload(so.id);
      if (p) pushOrderEvent("order_updated", p);
    }

    const payload = await buildDashboardOrderPayload(orderId);
    return NextResponse.json(payload);
  }

  const [updated] = await db
    .update(orders)
    .set(updates)
    .where(eq(orders.id, orderId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If a dine-in order is cancelled/rejected and has a tableSessionId, refresh other orders in that session so sessionTotalPaise updates
  if (existing.tableSessionId && (status === "cancelled" || status === "rejected")) {
    const sessionOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.tableSessionId, existing.tableSessionId));

    for (const so of sessionOrders) {
      const p = await buildDashboardOrderPayload(so.id);
      if (p) pushOrderEvent("order_updated", p);
    }
  }

  const payload = await buildDashboardOrderPayload(orderId);
  if (!payload) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Broadcast to all connected kitchen & rider screens
  pushOrderEvent("order_updated", payload);
  if (riderId) {
    pushOrderEvent("rider_assigned", payload);
  }

  return NextResponse.json(payload);
}
