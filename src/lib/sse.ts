import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, restaurantTables, tableSessions } from "@/lib/db/schema";

type Writer = (chunk: string) => void;

const g = globalThis as unknown as { __sseClients?: Set<Writer> };
export const sseClients: Set<Writer> = (g.__sseClients ??= new Set<Writer>());

export interface DashboardOrderItem {
  id: string;
  name: string;
  variantName: string | null;
  quantity: number;
  totalPaise: number;
}

export interface DashboardOrderPayload {
  id: string;
  displayId: string;
  customerName: string | null;
  customerPhone: string | null;
  orderType: "delivery" | "pickup" | "dine_in";
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "rejected";
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "pay_at_counter";
  paymentMethod: "razorpay" | "cash_on_delivery" | "pay_at_counter" | null;
  totalPaise: number;
  discountPaise: number;
  tableName: string | null;
  tableSessionId: string | null;
  sessionTotalPaise: number;
  sessionOrderCount: number;
  sessionBillGenerated: boolean;
  createdAt: string;
  itemCount: number;
  items: DashboardOrderItem[];
  deliveryAddress: {
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    pincode: string;
    lat?: number;
    lng?: number;
  } | null;
  specialInstructions: string | null;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderReachedAt: string | null;
  refundToken?: string | null;
  refundStatus?: string | null;
  refundRequestedAt?: string | null;
  refundProcessedAt?: string | null;
  refundNote?: string | null;
}

/**
 * Shared helper that determines if a rejected/cancelled order was paid and is eligible
 * for the Customer-to-Owner Refund Verification Token workflow.
 */
export function isOrderRefundEligible(order: {
  status: string;
  paymentStatus: string;
}): boolean {
  return (
    (order.status === "rejected" || order.status === "cancelled") &&
    (order.paymentStatus === "paid" || order.paymentStatus === "refunded")
  );
}

/**
 * Batch-fetches and maps dashboard orders in a single efficient set of queries.
 * Used by both /dashboard/orders and /dashboard/rider to avoid duplicated mapping logic.
 */
export async function fetchDashboardOrders(options?: {
  serviceMode?: "delivery" | "pickup" | "dine_in";
  limit?: number;
}): Promise<DashboardOrderPayload[]> {
  const limit = options?.limit ?? 100;
  const orderRows = options?.serviceMode
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.serviceMode, options.serviceMode))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
    : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);

  // Exclude unpaid abandoned Razorpay checkout drafts
  const visibleRows = orderRows.filter(
    (o) => !(o.paymentMethod === "razorpay" && o.paymentStatus === "pending")
  );
  if (visibleRows.length === 0) return [];

  const orderIds = visibleRows.map((o) => o.id);
  const [allItems, tableRows] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        name: orderItems.name,
        variantName: orderItems.variantName,
        quantity: orderItems.quantity,
        totalPaise: orderItems.totalPaise,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds)),
    db.select({ id: restaurantTables.id, name: restaurantTables.name }).from(restaurantTables),
  ]);

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

  return visibleRows.map((o) => {
    const items = allItems
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        variantName: i.variantName,
        quantity: i.quantity,
        totalPaise: i.totalPaise,
      }));

    const normalizedStatus = o.status === "preparing" ? "confirmed" : o.status;

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
      deliveryAddress:
        (o.deliveryAddress as DashboardOrderPayload["deliveryAddress"]) ?? null,
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
}

export async function buildDashboardOrderPayload(
  orderId: string
): Promise<DashboardOrderPayload | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      variantName: orderItems.variantName,
      quantity: orderItems.quantity,
      totalPaise: orderItems.totalPaise,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  let tableName: string | null = null;
  if (order.tableId) {
    const [tbl] = await db
      .select({ name: restaurantTables.name })
      .from(restaurantTables)
      .where(eq(restaurantTables.id, order.tableId))
      .limit(1);
    tableName = tbl?.name ?? null;
  }

  const normalizedStatus = order.status === "preparing" ? "confirmed" : order.status;

  let sessionTotalPaise = order.totalPaise;
  let sessionOrderCount = 1;
  let sessionBillGenerated =
    normalizedStatus === "out_for_delivery" || normalizedStatus === "delivered";

  if (order.tableSessionId) {
    const sessionOrders = await db
      .select({
        id: orders.id,
        totalPaise: orders.totalPaise,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.tableSessionId, order.tableSessionId));

    const validSessionOrders = sessionOrders.filter(
      (so) => so.status !== "cancelled" && so.status !== "rejected"
    );
    if (validSessionOrders.length > 0) {
      sessionTotalPaise = validSessionOrders.reduce((s, so) => s + so.totalPaise, 0);
      sessionOrderCount = validSessionOrders.length;
    }

    const [sess] = await db
      .select({ notes: tableSessions.notes, status: tableSessions.status })
      .from(tableSessions)
      .where(eq(tableSessions.id, order.tableSessionId))
      .limit(1);

    if (
      sess?.notes === "bill_generated" ||
      sess?.status === "closed" ||
      validSessionOrders.some((so) => so.status === "out_for_delivery" || so.status === "delivered")
    ) {
      sessionBillGenerated = true;
    }
  }

  return {
    id: order.id,
    displayId: order.orderNumber,
    customerName: order.guestName ?? null,
    customerPhone: order.guestPhone ?? null,
    orderType: order.serviceMode,
    status: normalizedStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod ?? null,
    totalPaise: order.totalPaise,
    discountPaise: order.discountPaise ?? 0,
    tableName,
    tableSessionId: order.tableSessionId ?? null,
    sessionTotalPaise,
    sessionOrderCount,
    sessionBillGenerated,
    createdAt: order.createdAt.toISOString(),
    itemCount: items.reduce((s, i) => s + i.quantity, 0) || items.length,
    items,
    deliveryAddress: (order.deliveryAddress as DashboardOrderPayload["deliveryAddress"]) ?? null,
    specialInstructions: order.specialInstructions ?? null,
    riderId: order.riderId ?? null,
    riderName: order.riderName ?? null,
    riderPhone: order.riderPhone ?? null,
    riderReachedAt: order.riderReachedAt ? order.riderReachedAt.toISOString() : null,
    refundToken: order.refundToken ?? null,
    refundStatus: order.refundStatus ?? "none",
    refundRequestedAt: order.refundRequestedAt ? order.refundRequestedAt.toISOString() : null,
    refundProcessedAt: order.refundProcessedAt ? order.refundProcessedAt.toISOString() : null,
    refundNote: order.refundNote ?? null,
  };
}

export function pushOrderEvent(event: string, payload: object) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((writer) => {
    try {
      writer(chunk);
    } catch {
      sseClients.delete(writer);
    }
  });
}
