import { eq } from "drizzle-orm";
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
  } | null;
  specialInstructions: string | null;
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

  let sessionTotalPaise = order.totalPaise;
  let sessionOrderCount = 1;
  let sessionBillGenerated = order.status === "out_for_delivery" || order.status === "delivered";

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
    status: order.status,
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
