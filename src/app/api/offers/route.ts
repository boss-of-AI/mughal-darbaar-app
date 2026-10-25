import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuItems, offers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.isActive, true))
      .orderBy(desc(offers.createdAt));

    const allItems = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        categoryId: menuItems.categoryId,
      })
      .from(menuItems);

    const enriched = activeOffers.map((o) => {
      if (!o.categoryId) {
        return {
          ...o,
          eligibleItemIds: null as string[] | null,
          eligibleItemNames: null as string[] | null,
        };
      }
      const matching = allItems.filter((i) => i.categoryId === o.categoryId);
      return {
        ...o,
        eligibleItemIds: matching.map((i) => i.id),
        eligibleItemNames: matching.map((i) => i.name.toLowerCase()),
      };
    });

    return NextResponse.json({ offers: enriched });
  } catch {
    return NextResponse.json({ offers: [] });
  }
}
