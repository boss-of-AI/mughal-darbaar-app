import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { restaurantSettings } from "@/lib/db/schema";
import { evaluateStoreStatus } from "@/lib/store-hours";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings] = await db.select().from(restaurantSettings).limit(1);
    const status = evaluateStoreStatus({
      isAcceptingOrders: settings?.isAcceptingOrders ?? true,
      openingHours: settings?.openingHours,
    });
    return NextResponse.json(status);
  } catch {
    return NextResponse.json(evaluateStoreStatus());
  }
}
