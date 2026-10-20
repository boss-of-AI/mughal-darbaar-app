import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, paymentRecords, restaurantSettings } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

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

  await db
    .update(orders)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const payload = await buildDashboardOrderPayload(orderId);
  if (payload) {
    pushOrderEvent("new_order", payload);
  }

  return NextResponse.json({ ok: true, orderId });
}
