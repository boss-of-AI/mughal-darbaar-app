import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.isActive, true))
      .orderBy(desc(offers.createdAt));

    return NextResponse.json({ offers: activeOffers });
  } catch {
    return NextResponse.json({ offers: [] });
  }
}
