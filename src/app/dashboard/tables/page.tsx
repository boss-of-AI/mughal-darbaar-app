import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { restaurantTables, tableSessions } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import TablesClient, { type TableRow } from "./TablesClient";

export const metadata: Metadata = { title: `Tables & QR — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardTablesPage() {
  let tables: TableRow[] = [];

  try {
    const [tableRows, openSessions] = await Promise.all([
      db.select().from(restaurantTables).orderBy(restaurantTables.sortOrder),
      db.select().from(tableSessions).where(eq(tableSessions.status, "open")),
    ]);

    const openTableIds = new Set(openSessions.map((s) => s.tableId));

    tables = tableRows.map((t) => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      qrToken: t.qrToken ?? "",
      isActive: t.isActive,
      hasOpenSession: openTableIds.has(t.id),
    }));
  } catch {
    // DB not connected yet
  }

  return (
    <TablesClient
      initialTables={tables}
      restaurantName={restaurantConfig.name}
      baseUrl={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
    />
  );
}
