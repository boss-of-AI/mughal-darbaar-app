import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

let seededInProcess = false;

/**
 * Ensures the default Rider, Chef, and Counter Staff accounts exist in PostgreSQL
 * so the Owner can immediately test and allot orders out-of-the-box.
 */
export async function ensureDefaultTeamAccounts() {
  if (seededInProcess) return;
  try {
    const existing = await db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(inArray(users.role, ["rider", "chef", "staff"]));

    const hasRider = existing.some((u) => u.role === "rider");
    const hasChef = existing.some((u) => u.role === "chef");
    const hasStaff = existing.some((u) => u.role === "staff");

    if (!hasRider) {
      const passwordHash = await bcrypt.hash("Rider@1234", 12);
      await db
        .insert(users)
        .values({
          name: "Imran Khan (Rider)",
          email: "rider@mughaldarbaar.in",
          phone: "9876543211",
          passwordHash,
          role: "rider",
          isActive: true,
        })
        .onConflictDoNothing();
    }

    if (!hasChef) {
      const passwordHash = await bcrypt.hash("Chef@1234", 12);
      await db
        .insert(users)
        .values({
          name: "Ustad Karim (Head Chef)",
          email: "chef@mughaldarbaar.in",
          phone: "9876543212",
          passwordHash,
          role: "chef",
          isActive: true,
        })
        .onConflictDoNothing();
    }

    if (!hasStaff) {
      const passwordHash = await bcrypt.hash("Staff@1234", 12);
      await db
        .insert(users)
        .values({
          name: "Aamir Baig (Counter Staff)",
          email: "staff@mughaldarbaar.in",
          phone: "9876543213",
          passwordHash,
          role: "staff",
          isActive: true,
        })
        .onConflictDoNothing();
    }

    seededInProcess = true;
  } catch {
    // Ignore if DB is not connected yet
  }
}
