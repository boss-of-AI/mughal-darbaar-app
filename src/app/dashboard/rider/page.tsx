import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderItems, orders, users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import type { DashboardOrderPayload } from "@/lib/sse";
import RiderClient from "./RiderClient";

export const metadata: Metadata = {
  title: `Rider Delivery Portal — ${restaurantConfig.name}`,
};
export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "rider";
  const currentUserName = session?.user?.name ?? "Delivery Rider";

  let initialOrders: DashboardOrderPayload[] = [];
  let riders: { id: string; name: string; phone: string | null }[] = [];

  try {
    const [orderRows, riderRows] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(eq(orders.serviceMode, "delivery"))
        .orderBy(desc(orders.createdAt))
        .limit(100),
      db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.role, "rider")),
    ]);

    riders = riderRows.map((r) => ({
      id: r.id,
      name: r.name ?? "Delivery Rider",
      phone: r.phone ?? null,
    }));

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

    initialOrders = visibleRows.map((o) => {
      const items = allItems
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          variantName: i.variantName,
          quantity: i.quantity,
          totalPaise: i.totalPaise,
        }));

      return {
        id: o.id,
        displayId: o.orderNumber,
        customerName: o.guestName ?? null,
        customerPhone: o.guestPhone ?? null,
        orderType: o.serviceMode,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod ?? null,
        totalPaise: o.totalPaise,
        discountPaise: o.discountPaise ?? 0,
        tableName: null,
        tableSessionId: null,
        sessionTotalPaise: o.totalPaise,
        sessionOrderCount: 1,
        sessionBillGenerated: false,
        createdAt: o.createdAt.toISOString(),
        itemCount: items.reduce((s, i) => s + i.quantity, 0) || items.length,
        items,
        deliveryAddress:
          (o.deliveryAddress as DashboardOrderPayload["deliveryAddress"]) ?? null,
        specialInstructions: o.specialInstructions ?? null,
        riderId: o.riderId ?? null,
        riderName: o.riderName ?? null,
        riderPhone: o.riderPhone ?? null,
        riderReachedAt: o.riderReachedAt ? o.riderReachedAt.toISOString() : null,
      };
    });
  } catch {
    // DB not connected
  }

  return (
    <RiderClient
      initialOrders={initialOrders}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      currentUserName={currentUserName}
      riders={riders}
    />
  );
}
