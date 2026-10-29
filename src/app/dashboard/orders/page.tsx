import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  restaurantSettings,
  restaurantTables,
  tableSessions,
  users,
} from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";
import type { Order, RiderOption } from "./OrdersClient";
import { restaurantConfig } from "@/config/restaurant.config";
import { evaluateStoreStatus } from "@/lib/store-hours";

export const metadata: Metadata = { title: `Orders — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic"; // Always fetch fresh

export default async function OrdersPage() {
  const session = await auth();
  const userRole = session?.user?.role ?? "staff";
  let initial: Order[] = [];
  let riders: RiderOption[] = [];
  let storeStatus = evaluateStoreStatus();

  try {
    const [settingsRow] = await db.select().from(restaurantSettings).limit(1);
    if (settingsRow) {
      storeStatus = evaluateStoreStatus({
        isAcceptingOrders: settingsRow.isAcceptingOrders,
        openingHours: settingsRow.openingHours,
      });
    }
    let riderRows = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.role, "rider"));

    if (riderRows.length === 0) {
      const passwordHash = await bcrypt.hash("Rider@1234", 12);
      const [createdRider] = await db
        .insert(users)
        .values({
          name: "Imran Khan (Rider)",
          email: "rider@mughaldarbaar.in",
          phone: "9876543211",
          passwordHash,
          role: "rider",
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({
          id: users.id,
          name: users.name,
          phone: users.phone,
        });
      if (createdRider) {
        riderRows = [createdRider];
      }
    }

    riders = riderRows.map((r) => ({
      id: r.id,
      name: r.name ?? "Delivery Rider",
      phone: r.phone ?? null,
    }));

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

    const tableRows = await db
      .select({ id: restaurantTables.id, name: restaurantTables.name })
      .from(restaurantTables);
    const tableMap = new Map(tableRows.map((t) => [t.id, t.name]));

    const sessionIds = Array.from(
      new Set(visibleRows.map((o) => o.tableSessionId).filter((s): s is string => Boolean(s)))
    );
    const sessionRows =
      sessionIds.length > 0
        ? await db
            .select({
              id: tableSessions.id,
              status: tableSessions.status,
              notes: tableSessions.notes,
            })
            .from(tableSessions)
            .where(inArray(tableSessions.id, sessionIds))
        : [];
    const sessionMap = new Map(sessionRows.map((s) => [s.id, s]));

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
        o.status === "preparing" ? "confirmed" : o.status;

      let sessionTotalPaise = o.totalPaise;
      let sessionOrderCount = 1;
      let sessionBillGenerated =
        normalizedStatus === "out_for_delivery" || normalizedStatus === "delivered";

      if (o.tableSessionId) {
        const sameSessionOrders = visibleRows.filter(
          (so) =>
            so.tableSessionId === o.tableSessionId &&
            so.status !== "cancelled" &&
            so.status !== "rejected"
        );
        if (sameSessionOrders.length > 0) {
          sessionTotalPaise = sameSessionOrders.reduce((s, so) => s + so.totalPaise, 0);
          sessionOrderCount = sameSessionOrders.length;
        }
        const sess = sessionMap.get(o.tableSessionId);
        if (
          sess?.notes === "bill_generated" ||
          sess?.status === "closed" ||
          sameSessionOrders.some(
            (so) => so.status === "out_for_delivery" || so.status === "delivered"
          )
        ) {
          sessionBillGenerated = true;
        }
      }

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
        discountPaise: o.discountPaise ?? 0,
        tableName: o.tableId ? tableMap.get(o.tableId) ?? null : null,
        tableSessionId: o.tableSessionId ?? null,
        sessionTotalPaise,
        sessionOrderCount,
        sessionBillGenerated,
        createdAt: o.createdAt.toISOString(),
        itemCount: items.reduce((s, i) => s + i.quantity, 0) || items.length,
        items,
        deliveryAddress: (o.deliveryAddress as Order["deliveryAddress"]) ?? null,
        specialInstructions: o.specialInstructions ?? null,
        riderId: o.riderId ?? null,
        riderName: o.riderName ?? null,
        riderPhone: o.riderPhone ?? null,
        riderReachedAt: o.riderReachedAt ? o.riderReachedAt.toISOString() : null,
        refundToken: o.refundToken ?? null,
        refundStatus: o.refundStatus ?? "none",
        refundRequestedAt: o.refundRequestedAt ? o.refundRequestedAt.toISOString() : null,
        refundProcessedAt: o.refundProcessedAt ? o.refundProcessedAt.toISOString() : null,
        refundNote: o.refundNote ?? null,
      };
    });
  } catch {
    // DB not connected
  }

  return (
    <OrdersClient
      initial={initial}
      riders={riders}
      userRole={userRole}
      initialStoreStatus={storeStatus}
    />
  );
}
