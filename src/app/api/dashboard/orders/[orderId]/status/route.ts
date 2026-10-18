import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { pushOrderEvent } from "@/lib/sse";

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled", "rejected"]),
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
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { status } = parsed.data;
  const now = new Date();
  const timestamps: Partial<typeof orders.$inferInsert> = { updatedAt: now };
  if (status === "confirmed") timestamps.acceptedAt = now;
  if (status === "ready") timestamps.readyAt = now;
  if (status === "delivered") timestamps.deliveredAt = now;
  if (status === "cancelled" || status === "rejected") timestamps.cancelledAt = now;

  const [updated] = await db
    .update(orders)
    .set({ status, ...timestamps })
    .where(eq(orders.id, orderId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Get item count for SSE payload
  const [itemCountRow] = await db
    .select({ cnt: count() })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const payload = {
    id: updated.id,
    displayId: updated.orderNumber,
    customerName: updated.guestName,
    customerPhone: updated.guestPhone,
    orderType: updated.serviceMode,
    status: updated.status,
    totalPaise: updated.totalPaise,
    createdAt: updated.createdAt.toISOString(),
    itemCount: itemCountRow?.cnt ?? 0,
  };

  // Broadcast to all connected kitchen screens
  pushOrderEvent("order_updated", payload);

  return NextResponse.json(payload);
}
