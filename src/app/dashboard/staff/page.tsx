import type { Metadata } from "next";
import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import StaffClient, { type StaffMember } from "./StaffClient";

export const metadata: Metadata = { title: `Staff & Riders — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardStaffPage() {
  let staffList: StaffMember[] = [];

  try {
    let rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(inArray(users.role, ["owner", "staff", "rider"]));

    // Ensure at least one default Rider account exists out-of-the-box
    if (!rows.some((r) => r.role === "rider")) {
      const passwordHash = await bcrypt.hash("Rider@1234", 12);
      const [createdRider] = await db
        .insert(users)
        .values({
          name: "Imran Khan (Rider)",
          email: "rider@mughaldarbaar.in",
          phone: "9876543211",
          passwordHash,
          role: "rider",
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
        });
      if (createdRider) {
        rows = [...rows, createdRider];
      }
    }

    staffList = rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Staff",
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
