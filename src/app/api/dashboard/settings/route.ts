import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantSettings } from "@/lib/db/schema";

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  tagline: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  gstin: z.string().trim().max(30).optional(),
  fssaiNumber: z.string().trim().max(30).optional(),
  gstRatePct: z.number().min(0).max(28),
  minimumOrderPaise: z.number().int().min(0).max(5_000_000),
  deliveryFeePaise: z.number().int().min(0).max(500_000),
  freeDeliveryAbovePaise: z.number().int().min(0).max(10_000_000).nullable(),
  estimatedDeliveryTime: z.string().trim().max(60),
  estimatedPickupTime: z.string().trim().max(60),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  dineInEnabled: z.boolean(),
  razorpayKeyId: z.string().trim().max(120).optional(),
  razorpayKeySecret: z.string().trim().max(120).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const values = {
    name: d.name,
    tagline: d.tagline || null,
    phone: d.phone || null,
    email: d.email || null,
    gstin: d.gstin || null,
    fssaiNumber: d.fssaiNumber || null,
    gstRatePct: d.gstRatePct.toFixed(2),
    minimumOrderPaise: d.minimumOrderPaise,
    deliveryFeePaise: d.deliveryFeePaise,
    freeDeliveryAbovePaise: d.freeDeliveryAbovePaise,
    estimatedDeliveryTime: d.estimatedDeliveryTime,
    estimatedPickupTime: d.estimatedPickupTime,
    deliveryEnabled: d.deliveryEnabled,
    pickupEnabled: d.pickupEnabled,
    dineInEnabled: d.dineInEnabled,
    razorpayKeyId: d.razorpayKeyId || null,
    ...(d.razorpayKeySecret ? { razorpayKeySecret: d.razorpayKeySecret } : {}),
    updatedAt: new Date(),
  };

  try {
    const [existing] = await db.select().from(restaurantSettings).limit(1);
    let saved;
    if (existing) {
      [saved] = await db
        .update(restaurantSettings)
        .set(values)
        .where(eq(restaurantSettings.id, existing.id))
        .returning();
    } else {
      [saved] = await db.insert(restaurantSettings).values(values).returning();
    }

    revalidatePath("/menu");
    revalidatePath("/checkout");
    revalidatePath("/dashboard/settings");

    return NextResponse.json({ ok: true, id: saved.id });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
