import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import { fetchDashboardOrders, type DashboardOrderPayload } from "@/lib/sse";
import { ensureDefaultTeamAccounts } from "@/lib/team-defaults";
import RiderClient from "./RiderClient";

export const metadata: Metadata = {
  title: `Rider Delivery Portal — ${restaurantConfig.name}`,
};
export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "rider";
  const currentUserName = session?.user?.name ?? "Delivery Rider";

  let initialOrders: DashboardOrderPayload[] = [];
  let riders: { id: string; name: string; phone: string | null }[] = [];

  try {
    await ensureDefaultTeamAccounts();

    const [fetchedOrders, riderRows] = await Promise.all([
      fetchDashboardOrders({ serviceMode: "delivery", limit: 100 }),
      db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.role, "rider")),
    ]);

    riders = riderRows.map((r) => ({
      id: r.id,
      name: r.name ?? "Delivery Rider",
      phone: r.phone ?? null,
    }));

    initialOrders = fetchedOrders;
  } catch {
    // DB not connected
  }

  return (
    <RiderClient
      initialOrders={initialOrders}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      currentUserName={currentUserName}
      riders={riders}
    />
  );
}
