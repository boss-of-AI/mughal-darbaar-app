import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { desc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";
import type { Order } from "./OrdersClient";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = { title: `Orders — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic"; // Always fetch fresh

export default async function OrdersPage() {
  let initial: Order[] = [];

  try {
    const rows = await db
      .select({
        id: orders.id,
        displayId: orders.orderNumber,
        customerName: orders.guestName,
        customerPhone: orders.guestPhone,
        orderType: orders.serviceMode,
        status: orders.status,
        totalPaise: orders.totalPaise,
        createdAt: orders.createdAt,
        itemCount: count(orderItems.id),
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt))
      .limit(100);

    initial = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      customerName: r.customerName ?? null,
      customerPhone: r.customerPhone ?? null,
    })) as Order[];
  } catch {
    // DB not connected
  }

  return <OrdersClient initial={initial} />;
}
