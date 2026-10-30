import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, deliveryAddresses, orders, sessions, users } from "@/lib/db/schema";

const updateStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  email: z.string().trim().email("Enter a valid email address").max(120).optional(),
  phone: z.string().trim().max(25).nullable().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .optional()
    .or(z.literal("")),
  role: z.enum(["staff", "chef", "rider", "owner"]).optional(),
});

/**
 * PATCH /api/dashboard/staff/[id]
 * Allows the Owner ("owner") to edit any Staff, Chef, or Rider account,
 * OR allows a logged-in Staff, Chef, or Rider to update their own profile
 * (name, email/Gmail, phone number, and password).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isOwner = session.user.role === "owner";
  const isSelf = session.user.id === id;

  if (!isOwner && !isSelf) {
    return NextResponse.json(
      { error: "You can only edit your own profile details." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details" },
      { status: 400 }
    );
  }

  const { name, email, phone, password, role } = parsed.data;

  try {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updates.name = name;
    }

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase();
      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, normalizedEmail), ne(users.id, id)))
        .limit(1);
      if (dup) {
        return NextResponse.json(
          { error: "Another account is already using this email address." },
          { status: 409 }
        );
      }
      updates.email = normalizedEmail;
    }

    if (phone !== undefined) {
      const trimmedPhone = phone ? phone.trim() : null;
      const effectiveRole = role !== undefined && isOwner ? role : existing.role;
      if (effectiveRole === "rider" && (!trimmedPhone || trimmedPhone.replace(/\D/g, "").length < 10)) {
        return NextResponse.json(
          { error: "A valid 10-digit mobile number is required for Delivery Riders." },
          { status: 400 }
        );
      }
      updates.phone = trimmedPhone;
    } else if (role === "rider" && isOwner) {
      if (!existing.phone || existing.phone.replace(/\D/g, "").length < 10) {
        return NextResponse.json(
          { error: "A valid 10-digit mobile number is required before assigning the Rider role." },
          { status: 400 }
        );
      }
    }

    if (role !== undefined && isOwner) {
      if (id === session.user.id && role !== "owner") {
        return NextResponse.json(
          { error: "You cannot demote your own active Owner account." },
          { status: 400 }
        );
      }
      updates.role = role;
    }

    if (password && password.length >= 8) {
      updates.passwordHash = await bcrypt.hash(password, 12);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
      });

    // If a Rider's name or phone changed, sync it to their allotted orders
    if (updated && (updated.role === "rider" || existing.role === "rider")) {
      await db
        .update(orders)
        .set({
          riderName: updated.name ?? "Delivery Rider",
          riderPhone: updated.phone ?? null,
        })
        .where(eq(orders.riderId, id));
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update account details" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/staff/[id]
 * Strictly restricted to the Restaurant Owner ("owner").
 * Deletes a Staff, Chef, or Rider account and safely unlinks any order references.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Restaurant Owner (Admin) can delete team accounts." },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own active Owner account." },
      { status: 400 }
    );
  }

  try {
    // Unlink any foreign key references before deleting user row
    await db
      .update(orders)
      .set({ riderId: null })
      .where(eq(orders.riderId, id));
    await db
      .update(orders)
      .set({ userId: null })
      .where(eq(orders.userId, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(accounts).where(eq(accounts.userId, id));
    await db.delete(deliveryAddresses).where(eq(deliveryAddresses.userId, id));

    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ ok: true, deletedId: id });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete team member" },
      { status: 500 }
    );
  }
}
