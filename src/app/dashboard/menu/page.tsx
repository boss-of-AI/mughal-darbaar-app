import type { Metadata } from "next";
import { ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemVariants, menuCategories, menuItems } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import MenuManagerClient, { type CategoryRow, type MenuItemRow } from "./MenuManagerClient";

export const metadata: Metadata = { title: `Menu Manager — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardMenuPage() {
  let categories: CategoryRow[] = [];
  let items: MenuItemRow[] = [];

  try {
    const [catRows, itemRows, variantRows] = await Promise.all([
      db.select().from(menuCategories).orderBy(menuCategories.sortOrder),
      db
        .select()
        .from(menuItems)
        .where(ne(menuItems.status, "archived"))
        .orderBy(menuItems.sortOrder),
      db.select().from(itemVariants).orderBy(itemVariants.sortOrder),
    ]);

    categories = catRows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
    }));

    items = itemRows.map((i) => ({
      id: i.id,
      categoryId: i.categoryId,
      name: i.name,
      description: i.description,
      imageUrl: i.imageUrl,
      pricePaise: i.pricePaise,
      isVegetarian: i.isVegetarian,
      isSpicy: i.isSpicy,
      spicyLevel: i.spicyLevel ?? 0,
      status: i.status,
      isFeatured: i.isFeatured,
      prepTimeMinutes: i.prepTimeMinutes,
      variants: variantRows
        .filter((v) => v.menuItemId === i.id)
        .map((v) => ({ id: v.id, name: v.name, pricePaise: v.pricePaise, isDefault: v.isDefault })),
    }));
  } catch {
    // DB not connected yet — renders empty state cleanly
  }

  return <MenuManagerClient initialCategories={categories} initialItems={items} />;
}
