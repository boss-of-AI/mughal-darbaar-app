import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantSettings, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";
import type { Order, RiderOption } from "./OrdersClient";
import { restaurantConfig } from "@/config/restaurant.config";
import { evaluateStoreStatus } from "@/lib/store-hours";
import { fetchDashboardOrders } from "@/lib/sse";
import { ensureDefaultTeamAccounts } from "@/lib/team-defaults";

export const metadata: Metadata = { title: `Orders — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await auth();
  const userRole = session?.user?.role ?? "staff";
  let initial: Order[] = [];
  let riders: RiderOption[] = [];
  let storeStatus = evaluateStoreStatus();

  try {
    await ensureDefaultTeamAccounts();

    const [[settingsRow], riderRows, fetchedOrders] = await Promise.all([
      db.select().from(restaurantSettings).limit(1),
      db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.role, "rider")),
      fetchDashboardOrders({ limit: 300 }),
    ]);

    if (settingsRow) {
      storeStatus = evaluateStoreStatus({
        isAcceptingOrders: settingsRow.isAcceptingOrders,
        openingHours: settingsRow.openingHours,
      });
    }

    riders = riderRows.map((r) => ({
      id: r.id,
      name: r.name ?? "Delivery Rider",
      phone: r.phone ?? null,
    }));

    initial = fetchedOrders;
  } catch {
    // DB not connected
  }

  return (
    <OrdersClient
      initial={initial}
      riders={riders}
      userRole={userRole}
      initialStoreStatus={storeStatus}
    />
  );
}
