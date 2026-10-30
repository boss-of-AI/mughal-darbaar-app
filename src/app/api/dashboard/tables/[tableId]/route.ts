import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, restaurantTables, tableSessions } from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

const patchTableSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  regenerateToken: z.boolean().optional(),
  closeSession: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { name, capacity, isActive, regenerateToken, closeSession } = parsed.data;

  try {
    if (closeSession) {
      const now = new Date();
      const openSessions = await db
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")));

      const openSessionIds = openSessions.map((s) => s.id);

      await db
        .update(tableSessions)
        .set({ status: "closed", closedAt: now, notes: "paid_and_closed" })
        .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")));

      if (openSessionIds.length > 0) {
        const affectedOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              inArray(orders.tableSessionId, openSessionIds),
              notInArray(orders.status, ["cancelled", "rejected"])
            )
          );

        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "delivered",
            deliveredAt: now,
            updatedAt: now,
          })
          .where(
            and(
              inArray(orders.tableSessionId, openSessionIds),
              notInArray(orders.status, ["cancelled", "rejected"])
            )
          );

        for (const ao of affectedOrders) {
          const payload = await buildDashboardOrderPayload(ao.id);
          if (payload) pushOrderEvent("order_updated", payload);
        }
      }
    }

    const updates: Partial<typeof restaurantTables.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = name;
    if (capacity !== undefined) updates.capacity = capacity;
    if (isActive !== undefined) updates.isActive = isActive;
    if (regenerateToken) {
      updates.qrToken = randomBytes(32).toString("hex");
    }

    const [updated] = await db
      .update(restaurantTables)
      .set(updates)
      .where(eq(restaurantTables.id, tableId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
  }
}
