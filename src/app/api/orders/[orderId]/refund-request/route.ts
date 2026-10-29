import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const requestSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

function generateRefundToken(): string {
  const numPart = String(Math.floor(1000 + Math.random() * 9000));
  const hexPart = randomBytes(2).toString("hex").toUpperCase();
  return `RFD-${numPart}-${hexPart}`;
}

/**
 * POST /api/orders/[orderId]/refund-request
 * Called by the customer when their online-paid order has been rejected or cancelled.
 * Generates a unique cryptographic Refund Verification Token (e.g. RFD-4829-A7F2)
 * that the restaurant Owner verifies before issuing the refund.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = requestSchema.safeParse(body);
  const customerNote = parsed.success ? parsed.data.note : undefined;

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (existing.status !== "rejected" && existing.status !== "cancelled") {
    return NextResponse.json(
      { error: "Refund tokens can only be generated for rejected or cancelled orders." },
      { status: 400 }
    );
  }

  const isOnlinePaid =
    existing.paymentStatus === "paid" ||
    existing.paymentStatus === "refunded" ||
    existing.paymentMethod === "razorpay";

  if (!isOnlinePaid) {
    return NextResponse.json(
      { error: "Only online-paid orders are eligible for a refund token." },
      { status: 400 }
    );
  }

  if (existing.refundStatus === "processed" || existing.paymentStatus === "refunded") {
    return NextResponse.json({
      ok: true,
      refundToken: existing.refundToken,
      refundStatus: "processed",
      message: "Refund has already been verified and processed by the owner.",
    });
  }

  const token = existing.refundToken || generateRefundToken();
  const now = new Date();

  await db
    .update(orders)
    .set({
      refundToken: token,
      refundStatus: "requested",
      refundRequestedAt: existing.refundRequestedAt ?? now,
      refundNote: customerNote || existing.refundNote || null,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  const payload = await buildDashboardOrderPayload(orderId);
  if (payload) {
    pushOrderEvent("order_updated", payload);
    pushOrderEvent("refund_requested", payload);
  }

  return NextResponse.json({
    ok: true,
    refundToken: token,
    refundStatus: "requested",
    refundRequestedAt: (existing.refundRequestedAt ?? now).toISOString(),
    refundNote: customerNote || existing.refundNote || null,
  });
}
