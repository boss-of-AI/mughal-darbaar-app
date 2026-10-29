import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(25).optional(),
  password: z.string().min(8).max(72),
  role: z.enum(["staff", "chef", "rider", "owner"]).default("staff"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    return NextResponse.json({ error: "Only the restaurant owner can add team members" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff details" }, { status: 400 });
  }

  const { name, email, phone, password, role } = parsed.data;
  if (session.user.role !== "owner" && role === "owner") {
    return NextResponse.json({ error: "Only owners can create another owner account" }, { status: 403 });
  }
  if (role === "rider" && (!phone || phone.replace(/\D/g, "").length < 10)) {
    return NextResponse.json(
      { error: "A valid 10-digit mobile number is required for Delivery Riders" },
      { status: 400 }
    );
  }
  const normalizedEmail = email.toLowerCase();

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email: normalizedEmail,
        phone: phone || null,
        passwordHash,
        role,
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create team member" }, { status: 500 });
  }
}
