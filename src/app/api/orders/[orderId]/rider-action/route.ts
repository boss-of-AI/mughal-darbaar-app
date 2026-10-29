import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const actionSchema = z.object({
  action: z.enum(["reached", "cash_collected", "delivered"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff", "rider"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { action } = parsed.data;
  const now = new Date();

  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (action === "reached") {
    await db
      .update(orders)
      .set({
        riderReachedAt: now,
        status: existing.status === "delivered" ? "delivered" : "out_for_delivery",
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    const payload = await buildDashboardOrderPayload(orderId);
    if (payload) {
      pushOrderEvent("order_updated", payload);
      pushOrderEvent("rider_reached", payload);
    }
    return NextResponse.json(payload);
  }

  // "cash_collected" or "delivered"
  await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "delivered",
      deliveredAt: now,
      riderReachedAt: existing.riderReachedAt ?? now,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  const payload = await buildDashboardOrderPayload(orderId);
  if (payload) {
    pushOrderEvent("order_updated", payload);
    pushOrderEvent("cash_collected", payload);
  }

  return NextResponse.json(payload);
}
