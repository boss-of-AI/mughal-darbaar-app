import type { Metadata } from "next";
import { db } from "@/lib/db";
import { itemVariants, menuCategories, menuItems, restaurantSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import MenuClient from "./MenuClient";
import { restaurantConfig } from "@/config/restaurant.config";
import { DEMO_CATEGORIES } from "@/lib/demo-menu";
import type { InferSelectModel } from "drizzle-orm";

type MenuCategory = InferSelectModel<typeof menuCategories>;
type MenuItem = InferSelectModel<typeof menuItems>;
type VariantRow = { id: string; name: string; pricePaise: number; isDefault: boolean };
type CategoryWithItems = MenuCategory & { items: (MenuItem & { variants: VariantRow[] })[] };

export const metadata: Metadata = {
  title: "Menu",
  description: `Browse our full menu of authentic Mughal dishes — biryanis, kebabs, curries, breads and more. Order online from ${restaurantConfig.name}.`,
};

export const revalidate = 60;

export default async function MenuPage() {
  let categoriesWithItems: CategoryWithItems[] = [];
  let gstPercent = "5.00";
  let deliveryFee = 4000;
  let freeDeliveryAbove = 50000;
  let minimumOrder = 25000;

  try {
    const [categories, items, settings, variantRows] = await Promise.all([
      db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.isActive, true))
        .orderBy(menuCategories.sortOrder),
      db
        .select()
        .from(menuItems)
        .where(eq(menuItems.status, "available"))
        .orderBy(menuItems.sortOrder),
      db.select().from(restaurantSettings).limit(1),
      db.select().from(itemVariants).orderBy(itemVariants.sortOrder),
    ]);

    const setting = settings[0];
    if (setting) {
      gstPercent = String(setting.gstRatePct);
      deliveryFee = setting.deliveryFeePaise;
      freeDeliveryAbove = setting.freeDeliveryAbovePaise ?? 50000;
      minimumOrder = setting.minimumOrderPaise;
    }

    categoriesWithItems = categories
      .map((cat) => ({
        ...cat,
        items: items
          .filter((item) => item.categoryId === cat.id)
          .map((item) => ({
            ...item,
            variants: variantRows
              .filter((v) => v.menuItemId === item.id)
              .map((v) => ({ id: v.id, name: v.name, pricePaise: v.pricePaise, isDefault: v.isDefault })),
          })),
      }))
      .filter((cat) => cat.items.length > 0);
  } catch {
    // DB not yet connected — falls back to DEMO_CATEGORIES below
  }

  if (categoriesWithItems.length === 0) {
    categoriesWithItems = DEMO_CATEGORIES;
  }

  return (
    <MenuClient
      categories={categoriesWithItems}
      gstPercent={gstPercent}
      deliveryFee={deliveryFee}
      freeDeliveryAbove={freeDeliveryAbove}
      minimumOrder={minimumOrder}
    />
  );
}
