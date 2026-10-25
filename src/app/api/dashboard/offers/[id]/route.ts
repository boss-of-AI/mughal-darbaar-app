import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";
import { pushOrderEvent } from "@/lib/sse";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [updated] = await db
    .update(offers)
    .set({ isActive: parsed.data.isActive })
    .where(eq(offers.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  pushOrderEvent("offer_updated", updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.delete(offers).where(eq(offers.id, id));
  pushOrderEvent("offer_updated", { deletedId: id });
  return NextResponse.json({ ok: true });
}
