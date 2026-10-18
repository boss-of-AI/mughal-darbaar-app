import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, paymentRecords } from "@/lib/db/schema";
import { pushOrderEvent } from "@/lib/sse";

/**
 * POST /api/webhooks/razorpay
 * Idempotently handles Razorpay payment.captured webhooks so orders are marked paid
 * even if the customer closes their browser before client callback completion.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await req.text();

  const expectedHex = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedHex, "utf8");

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured") {
    const paymentId = event.payload?.payment?.entity?.id;
    const rzpOrderId = event.payload?.payment?.entity?.order_id;

    if (paymentId && rzpOrderId) {
      const [record] = await db
        .select()
        .from(paymentRecords)
        .where(eq(paymentRecords.razorpayOrderId, rzpOrderId))
        .limit(1);

      if (record && record.status !== "paid") {
        await db
          .update(paymentRecords)
          .set({
            razorpayPaymentId: paymentId,
            status: "paid",
            webhookReceivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(paymentRecords.id, record.id));

        const [updatedOrder] = await db
          .update(orders)
          .set({ paymentStatus: "paid", updatedAt: new Date() })
          .where(eq(orders.id, record.orderId))
          .returning();

        if (updatedOrder) {
          const [cntRow] = await db
            .select({ cnt: count() })
            .from(orderItems)
            .where(eq(orderItems.orderId, updatedOrder.id));

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
      }
    }
  }

  return NextResponse.json({ received: true });
}
