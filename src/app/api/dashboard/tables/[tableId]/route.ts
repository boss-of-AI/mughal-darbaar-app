import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantTables, tableSessions } from "@/lib/db/schema";

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
      await db
        .update(tableSessions)
        .set({ status: "closed", closedAt: new Date() })
        .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")));
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
