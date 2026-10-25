import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { menuCategories, offers } from "@/lib/db/schema";
import { pushOrderEvent } from "@/lib/sse";

const createOfferSchema = z.object({
  title: z.string().trim().min(3, "Enter an offer title").max(120),
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters")
    .max(30)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  discountPct: z.number().int().min(1).max(90),
  categoryId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db.select().from(offers).orderBy(desc(offers.createdAt));
  return NextResponse.json(all);
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

  const parsed = createOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid offer details" },
      { status: 400 }
    );
  }

  const { title, code, discountPct, categoryId } = parsed.data;
  if (!code) {
    return NextResponse.json({ error: "Enter a valid alphanumeric coupon code" }, { status: 400 });
  }

  let categoryName = "All Categories";
  if (categoryId) {
    const [cat] = await db
      .select({ name: menuCategories.name })
      .from(menuCategories)
      .where(eq(menuCategories.id, categoryId))
      .limit(1);
    if (!cat) {
      return NextResponse.json({ error: "Selected category not found" }, { status: 400 });
    }
    categoryName = cat.name;
  }

  try {
    const [created] = await db
      .insert(offers)
      .values({
        title,
        code,
        discountPct,
        categoryId: categoryId || null,
        categoryName,
        isActive: true,
      })
      .returning();

    pushOrderEvent("offer_updated", created);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Coupon code already exists. Please use a different code." },
      { status: 409 }
    );
  }
}
