import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";

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
