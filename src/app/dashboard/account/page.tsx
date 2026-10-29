import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: `My Account & Credentials — ${restaurantConfig.name}`,
};
export const dynamic = "force-dynamic";

export default async function DashboardAccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  let initial = {
    id: session.user.id,
    name: session.user.name ?? "Team Member",
    email: session.user.email ?? "",
    phone: "",
    role: session.user.role ?? "staff",
  };

  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (row) {
      initial = {
        id: row.id,
        name: row.name ?? "Team Member",
        email: row.email ?? "",
        phone: row.phone ?? "",
        role: row.role,
      };
    }
  } catch {
    // DB not connected
  }

  return <AccountClient initial={initial} />;
}
