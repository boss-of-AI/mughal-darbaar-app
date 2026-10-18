import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { menuCategories } from "@/lib/db/schema";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
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

  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  const { name, description, sortOrder } = parsed.data;
  const baseSlug = slugify(name) || `category-${Date.now()}`;

  try {
    const [created] = await db
      .insert(menuCategories)
      .values({
        name,
        slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
        description: description || null,
        sortOrder,
        isActive: true,
      })
      .returning();

    revalidatePath("/menu");
    revalidatePath("/dashboard/menu");

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
