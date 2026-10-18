import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import StaffClient, { type StaffMember } from "./StaffClient";

export const metadata: Metadata = { title: `Staff — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardStaffPage() {
  let staffList: StaffMember[] = [];

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(inArray(users.role, ["owner", "staff"]));

    staffList = rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Staff",
      email: r.email ?? "",
      role: r.role,
      isActive: r.isActive,
    }));
  } catch {
    // DB not connected yet
  }

  return <StaffClient initialStaff={staffList} />;
}
