import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import { ensureDefaultTeamAccounts } from "@/lib/team-defaults";
import StaffClient, { type StaffMember } from "./StaffClient";

export const metadata: Metadata = {
  title: `Staff, Chefs & Riders — ${restaurantConfig.name}`,
};
export const dynamic = "force-dynamic";

export default async function DashboardStaffPage() {
  let staffList: StaffMember[] = [];

  try {
    await ensureDefaultTeamAccounts();

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(inArray(users.role, ["owner", "staff", "chef", "rider"]));

    staffList = rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Team Member",
      email: r.email ?? "",
      phone: r.phone ?? null,
      role: r.role,
      isActive: r.isActive,
    }));
  } catch {
    // DB not connected yet
  }

  return <StaffClient initialStaff={staffList} />;
}
