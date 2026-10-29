import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantSettings } from "@/lib/db/schema";
import {
  DAYS_ORDER,
  evaluateStoreStatus,
  normalizeWeeklySchedule,
} from "@/lib/store-hours";
import { pushOrderEvent } from "@/lib/sse";

const patchTimingsSchema = z.object({
  isAcceptingOrders: z.boolean().optional(),
  openTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
    .optional(),
  closeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
    .optional(),
  closedToday: z.boolean().optional(),
  applyScope: z.enum(["today", "all_days"]).default("all_days"),
});

/**
 * PATCH /api/dashboard/timings
 * Allows both Admin (owner) and Counter Staff (staff) to update
 * Restaurant Order Accepting Timings and Live/Closed status.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["owner", "staff"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchTimingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timing parameters" }, { status: 400 });
  }

  const { isAcceptingOrders, openTime, closeTime, closedToday, applyScope } =
    parsed.data;

  try {
    const [existing] = await db.select().from(restaurantSettings).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Restaurant settings not found" }, { status: 404 });
    }

    const weekly = normalizeWeeklySchedule(existing.openingHours);
    const currentStatus = evaluateStoreStatus({
      isAcceptingOrders: existing.isAcceptingOrders,
      openingHours: existing.openingHours,
    });

    if (openTime || closeTime || closedToday !== undefined) {
      const targetDays =
        applyScope === "today" ? [currentStatus.todayDay] : DAYS_ORDER;
      for (const dayKey of targetDays) {
        weekly[dayKey] = {
          open: openTime ?? weekly[dayKey].open,
          close: closeTime ?? weekly[dayKey].close,
          closed: closedToday ?? false,
        };
      }
    }

    const nextAccepting =
      isAcceptingOrders !== undefined
        ? isAcceptingOrders
        : existing.isAcceptingOrders;

    const [updated] = await db
      .update(restaurantSettings)
      .set({
        isAcceptingOrders: nextAccepting,
        openingHours: weekly,
        updatedAt: new Date(),
      })
      .where(eq(restaurantSettings.id, existing.id))
      .returning();

    const evaluated = evaluateStoreStatus({
      isAcceptingOrders: updated.isAcceptingOrders,
      openingHours: updated.openingHours,
    });

    pushOrderEvent("store_status_updated", evaluated);
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/checkout");
    revalidatePath("/dashboard/orders");

    return NextResponse.json(evaluated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update order accepting timings" },
      { status: 500 }
    );
  }
}
