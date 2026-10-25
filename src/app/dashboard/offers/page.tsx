import type { Metadata } from "next";
import { desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuCategories, offers } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import OffersClient, { type OfferRow, type CategoryOption } from "./OffersClient";

export const metadata: Metadata = { title: `Offers & Coupons — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardOffersPage() {
  let initialOffers: OfferRow[] = [];
  let categories: CategoryOption[] = [];

  try {
    const [offerRows, catRows] = await Promise.all([
      db.select().from(offers).orderBy(desc(offers.createdAt)),
      db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder)),
    ]);

    initialOffers = offerRows.map((o) => ({
      id: o.id,
      title: o.title,
      code: o.code,
      discountPct: o.discountPct,
      categoryId: o.categoryId,
      categoryName: o.categoryName ?? "All Categories",
      isActive: o.isActive,
      createdAt: o.createdAt.toISOString(),
    }));

    categories = catRows.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  } catch {
    // DB not connected yet
  }

  return <OffersClient initialOffers={initialOffers} categories={categories} />;
}
