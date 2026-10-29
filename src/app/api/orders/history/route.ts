import { NextRequest, NextResponse } from "next/server";
import { desc, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, restaurantTables } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPhone = (searchParams.get("phone") || "").replace(/\D/g, "");
  const cleanPhone10 = rawPhone.length >= 10 ? rawPhone.slice(-10) : "";
  const rawIds = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => uuidRe.test(s));

  if (!cleanPhone10 && rawIds.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  try {
    const conditions = [];
    if (cleanPhone10) {
      conditions.push(sql`RIGHT(REGEXP_REPLACE(${orders.guestPhone}, '[^0-9]', '', 'g'), 10) = ${cleanPhone10}`);
    }
    if (rawIds.length > 0) {
      conditions.push(inArray(orders.id, rawIds));
    }

    const matchedOrders = await db
      .select()
      .from(orders)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(50);

    if (matchedOrders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orderIds = matchedOrders.map((o) => o.id);
    const [allItems, allTables] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db
        .select({ id: restaurantTables.id, name: restaurantTables.name })
        .from(restaurantTables),
    ]);

    const tableMap = new Map(allTables.map((t) => [t.id, t.name]));

    const result = matchedOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      serviceMode: o.serviceMode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      subtotalPaise: o.subtotalPaise,
      discountPaise: o.discountPaise ?? 0,
      deliveryFeePaise: o.deliveryFeePaise,
      taxPaise: o.taxPaise,
      totalPaise: o.totalPaise,
      createdAt: o.createdAt.toISOString(),
      tableName: o.tableId ? tableMap.get(o.tableId) ?? null : null,
      riderName: o.riderName ?? null,
      riderPhone: o.riderPhone ?? null,
      riderReachedAt: o.riderReachedAt ? o.riderReachedAt.toISOString() : null,
      deliveryAddress: o.deliveryAddress ?? null,
      items: allItems
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          name: i.name,
          variantId: i.variantId,
          variantName: i.variantName,
          unitPricePaise: i.unitPricePaise,
          quantity: i.quantity,
          totalPaise: i.totalPaise,
        })),
    }));

    return NextResponse.json({ orders: result });
  } catch (err) {
    console.error("[GET /api/orders/history]", err);
    return NextResponse.json({ orders: [] });
  }
}
