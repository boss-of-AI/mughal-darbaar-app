import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantTables } from "@/lib/db/schema";

const createTableSchema = z.object({
  name: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(50).default(4),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

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

  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table details" }, { status: 400 });
  }

  const { name, capacity, sortOrder } = parsed.data;
  const qrToken = randomBytes(32).toString("hex"); // 256-bit token

  try {
    const [created] = await db
      .insert(restaurantTables)
      .values({
        name,
        capacity,
        qrToken,
        isActive: true,
        sortOrder,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
  }
}
