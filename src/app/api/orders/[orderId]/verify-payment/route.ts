import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderItems, orders, paymentRecords, restaurantSettings } from "@/lib/db/schema";
import { pushOrderEvent } from "@/lib/sse";

const verifySchema = z.object({
  razorpayOrderId: z.string().min(4).max(120),
  razorpayPaymentId: z.string().min(4).max(120),
  razorpaySignature: z.string().min(16).max(256),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification payload" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const [settings] = await db.select().from(restaurantSettings).limit(1);
  const secret = settings?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 });
  }

  const expectedHex = createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const sigBuf = Buffer.from(razorpaySignature, "utf8");
  const expBuf = Buffer.from(expectedHex, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  await db
    .update(paymentRecords)
    .set({
      razorpayPaymentId,
      razorpaySignature,
      status: "paid",
      updatedAt: new Date(),
    })
    .where(eq(paymentRecords.razorpayOrderId, razorpayOrderId));

  const [updatedOrder] = await db
    .update(orders)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  if (updatedOrder) {
    const [cntRow] = await db
      .select({ cnt: count() })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    pushOrderEvent("new_order", {
      id: updatedOrder.id,
      displayId: updatedOrder.orderNumber,
      customerName: updatedOrder.guestName,
      customerPhone: updatedOrder.guestPhone,
      orderType: updatedOrder.serviceMode,
      status: updatedOrder.status,
      totalPaise: updatedOrder.totalPaise,
      createdAt: updatedOrder.createdAt.toISOString(),
      itemCount: cntRow?.cnt ?? 0,
    });
  }

  return NextResponse.json({ ok: true, orderId });
}
