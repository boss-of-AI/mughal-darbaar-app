import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, paymentRecords } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const verifyRefundSchema = z.object({
  token: z
    .string()
    .trim()
    .min(4, "Please enter the customer's Refund Token"),
  ownerNote: z.string().trim().max(300).optional(),
});

/**
 * POST /api/dashboard/orders/[orderId]/refund
 * Strictly restricted to the Restaurant Owner ("owner").
 * Verifies the customer-generated Refund Token (e.g. RFD-4829-A7F2)
 * and processes the refund on a rejected/cancelled online paid order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Restaurant Owner (Admin) can verify refund tokens and process refunds." },
      { status: 403 }
    );
  }

  const { orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifyRefundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid refund token" },
      { status: 400 }
    );
  }

  const { token, ownerNote } = parsed.data;

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!existing.refundToken) {
    return NextResponse.json(
      { error: "Customer has not generated a refund verification token for this order yet." },
      { status: 400 }
    );
  }

  const normalizedInput = token.replace(/\s+/g, "").toUpperCase();
  const normalizedStored = existing.refundToken.replace(/\s+/g, "").toUpperCase();

  if (normalizedInput !== normalizedStored) {
    return NextResponse.json(
      { error: "Invalid Refund Token. Please verify the exact token shared by the customer." },
      { status: 400 }
    );
  }

  const now = new Date();
  const combinedNote = ownerNote
    ? `${existing.refundNote ? `${existing.refundNote} | ` : ""}Owner Refunded: ${ownerNote}`
    : existing.refundNote;

  await db
    .update(orders)
    .set({
      paymentStatus: "refunded",
      refundStatus: "processed",
      refundProcessedAt: now,
      refundNote: combinedNote ?? "Verified with customer token & refunded by Owner",
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  try {
    await db
      .update(paymentRecords)
      .set({
        status: "refunded",
        updatedAt: now,
      })
      .where(eq(paymentRecords.orderId, orderId));
  } catch {
    /* ignore if no payment_records row */
  }

  const payload = await buildDashboardOrderPayload(orderId);
  if (payload) {
    pushOrderEvent("order_updated", payload);
    pushOrderEvent("refund_processed", payload);
  }

  return NextResponse.json(payload);
}
