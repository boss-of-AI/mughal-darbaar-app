import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { itemVariants, menuItems } from "@/lib/db/schema";
import { getSuggestedDishImage } from "@/lib/dish-images";

const variantInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  pricePaise: z.number().int().min(100).max(10_000_000),
  isDefault: z.boolean().default(false),
});

const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).optional(),
  imageUrl: z.string().trim().max(1_500_000).optional(),
  pricePaise: z.number().int().min(100).max(10_000_000),
  isVegetarian: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  spicyLevel: z.number().int().min(0).max(3).default(0),
  isFeatured: z.boolean().default(false),
  prepTimeMinutes: z.number().int().min(1).max(240).optional(),
  variants: z.array(variantInputSchema).max(6).default([]),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid item data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const slug = `${slugify(data.name) || "dish"}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(menuItems)
        .values({
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description || null,
          imageUrl: data.imageUrl || getSuggestedDishImage(data.name),
          pricePaise: data.pricePaise,
          isVegetarian: data.isVegetarian,
          isSpicy: data.isSpicy,
          spicyLevel: data.isSpicy ? Math.max(1, data.spicyLevel) : 0,
          isFeatured: data.isFeatured,
          prepTimeMinutes: data.prepTimeMinutes ?? null,
          status: "available",
        })
        .returning();

      let createdVariants: (typeof itemVariants.$inferSelect)[] = [];
      if (data.variants.length > 0) {
        createdVariants = await tx
          .insert(itemVariants)
          .values(
            data.variants.map((v, idx) => ({
              menuItemId: item.id,
              name: v.name,
              pricePaise: v.pricePaise,
              isDefault: idx === 0 ? true : v.isDefault,
              sortOrder: idx,
            }))
          )
          .returning();
      }

      return { ...item, variants: createdVariants };
    });

    revalidatePath("/menu");
    revalidatePath("/dashboard/menu");

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}
