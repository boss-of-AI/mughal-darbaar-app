import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { restaurantTables } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tables = await db
      .select({
        id: restaurantTables.id,
        name: restaurantTables.name,
        capacity: restaurantTables.capacity,
        qrToken: restaurantTables.qrToken,
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.isActive, true))
      .orderBy(asc(restaurantTables.sortOrder), asc(restaurantTables.name));

    return NextResponse.json({ tables: tables.filter((t) => Boolean(t.qrToken)) });
  } catch {
    return NextResponse.json({ tables: [] });
  }
}
