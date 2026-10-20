import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  })
  .refine((d) => Boolean(d.status || d.paymentStatus), {
    message: "Provide status or paymentStatus",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { status, paymentStatus } = parsed.data;
  const now = new Date();
  const updates: Partial<typeof orders.$inferInsert> = { updatedAt: now };

  if (status) {
    updates.status = status;
    if (status === "confirmed") updates.acceptedAt = now;
    if (status === "ready") updates.readyAt = now;
    if (status === "delivered") updates.deliveredAt = now;
    if (status === "cancelled" || status === "rejected") updates.cancelledAt = now;
  }

  if (paymentStatus) {
    updates.paymentStatus = paymentStatus;
  }

  const [updated] = await db
    .update(orders)
    .set(updates)
    .where(eq(orders.id, orderId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const payload = await buildDashboardOrderPayload(orderId);
  if (!payload) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Broadcast to all connected kitchen screens
  pushOrderEvent("order_updated", payload);

  return NextResponse.json(payload);
}
