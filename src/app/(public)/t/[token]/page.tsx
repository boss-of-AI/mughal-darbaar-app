import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { restaurantTables } from "@/lib/db/schema";
import TableEntry from "./TableEntry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome", robots: { index: false } };

/** QR landing page: /t/<token>. Validates the token server-side, then stores it in the cart and opens the menu. */
export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 16 || token.length > 128) notFound();

  let table: { name: string } | undefined;
  try {
    [table] = await db
      .select({ name: restaurantTables.name })
      .from(restaurantTables)
      .where(and(eq(restaurantTables.qrToken, token), eq(restaurantTables.isActive, true)))
      .limit(1);
  } catch {
    notFound();
  }
  if (!table) notFound();

  return <TableEntry token={token} tableName={table.name} />;
}
