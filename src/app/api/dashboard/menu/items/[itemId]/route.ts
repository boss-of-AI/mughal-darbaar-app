import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { menuItems } from "@/lib/db/schema";

const patchItemSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  imageUrl: z.string().trim().max(1_500_000).nullable().optional(),
  pricePaise: z.number().int().min(100).max(10_000_000).optional(),
  status: z.enum(["available", "unavailable", "archived"]).optional(),
  isVegetarian: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff", "chef"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(menuItems)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(menuItems.id, itemId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    revalidatePath("/menu");
    revalidatePath("/dashboard/menu");

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update menu item" }, { status: 500 });
  }
}
