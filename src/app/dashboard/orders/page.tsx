import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";
import type { Order } from "./OrdersClient";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = { title: `Orders — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic"; // Always fetch fresh

export default async function OrdersPage() {
  let initial: Order[] = [];

  try {
    const orderRows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(100);

    const visibleRows = orderRows.filter(
      (o) => !(o.paymentMethod === "razorpay" && o.paymentStatus === "pending")
    );

    const orderIds = visibleRows.map((o) => o.id);
    const allItems =
      orderIds.length > 0
        ? await db
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              name: orderItems.name,
              variantName: orderItems.variantName,
              quantity: orderItems.quantity,
              totalPaise: orderItems.totalPaise,
            })
            .from(orderItems)
            .where(inArray(orderItems.orderId, orderIds))
        : [];

    initial = visibleRows.map((o) => {
      const items = allItems
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          variantName: i.variantName,
          quantity: i.quantity,
          totalPaise: i.totalPaise,
        }));
      const normalizedStatus =
        o.status === "preparing" || o.status === "ready" ? "confirmed" : o.status;
      return {
        id: o.id,
        displayId: o.orderNumber,
        customerName: o.guestName ?? null,
        customerPhone: o.guestPhone ?? null,
        orderType: o.serviceMode,
        status: normalizedStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod ?? null,
        totalPaise: o.totalPaise,
        createdAt: o.createdAt.toISOString(),
        itemCount: items.reduce((s, i) => s + i.quantity, 0) || items.length,
        items,
        deliveryAddress: (o.deliveryAddress as Order["deliveryAddress"]) ?? null,
        specialInstructions: o.specialInstructions ?? null,
      };
    });
  } catch {
    // DB not connected
  }

  return <OrdersClient initial={initial} />;
}
