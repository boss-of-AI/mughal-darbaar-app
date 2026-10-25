import { NextRequest, NextResponse } from "next/server";
import { randomInt, randomUUID } from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  addOnGroups,
  addOnOptions,
  itemVariants,
  menuItems,
  offers,
  orderItems,
  orders,
  paymentRecords,
  restaurantSettings,
  restaurantTables,
  tableSessions,
} from "@/lib/db/schema";
import { buildDashboardOrderPayload, pushOrderEvent } from "@/lib/sse";

/**
 * POST /api/orders — public order placement.
 *
 * SECURITY: the browser only sends IDs and quantities. Every price, the GST
 * amount, delivery fee and total are recomputed here from database values.
 * Supports Razorpay online payments (UPI/Cards) and Pay-at-counter / Cash-on-delivery.
 */

const phoneRe = /^(\+91|0)?[6-9]\d{9}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z
  .object({
    serviceMode: z.enum(["delivery", "pickup", "dine_in"]),
    paymentMethod: z.enum(["razorpay", "cash_on_delivery", "pay_at_counter"]).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1).max(120),
          name: z.string().trim().max(160).optional(),
          variantId: z.string().min(1).max(120).optional(),
          variantName: z.string().trim().max(80).optional(),
          quantity: z.number().int().min(1).max(20),
          addOnOptionIds: z.array(z.string().uuid()).max(20).default([]),
          note: z.string().trim().max(200).optional(),
        })
      )
      .min(1)
      .max(50),
    guest: z.object({
      name: z.string().trim().min(2, "Please enter your name").max(80),
      phone: z
        .string()
        .transform((s) => s.replace(/[\s\-()]/g, ""))
        .pipe(z.string().regex(phoneRe, "Enter a valid 10-digit Indian mobile number")),
      email: z.string().trim().email().max(120).optional().or(z.literal("")),
    }),
    address: z
      .object({
        line1: z.string().trim().min(3, "Enter your street/building address").max(200),
        line2: z.string().trim().max(200).optional(),
        landmark: z.string().trim().max(120).optional(),
        city: z.string().trim().min(2).max(80),
        pincode: z
          .string()
          .transform((s) => s.replace(/\s+/g, ""))
          .pipe(z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode")),
      })
      .optional(),
    tableToken: z.string().min(16).max(128).optional(),
    couponCode: z.string().trim().max(30).optional(),
    specialInstructions: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.serviceMode === "delivery" && !v.address)
      ctx.addIssue({ code: "custom", path: ["address"], message: "Delivery address required" });
    if (v.serviceMode === "dine_in" && !v.tableToken)
      ctx.addIssue({ code: "custom", path: ["tableToken"], message: "Table QR required" });
  });

// Naive per-instance rate limiter (fine for a single Railway container).
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 15, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}

function makeOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ORD-${ymd}-${String(randomInt(0, 100000)).padStart(5, "0")}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstMsg =
      Object.values(flat.fieldErrors).flat()[0] ||
      flat.formErrors[0] ||
      "Please check your order details";
    return NextResponse.json(
      { error: firstMsg, details: flat },
      { status: 400 }
    );
  }
  const input = parsed.data;

  let settings: typeof restaurantSettings.$inferSelect | undefined;
  try {
    [settings] = await db.select().from(restaurantSettings).limit(1);
  } catch {
    return NextResponse.json(
      { error: "Database is not connected yet. Connect PostgreSQL and run npm run db:push && npm run db:seed to place live orders." },
      { status: 503 }
    );
  }
  if (!settings) {
    return NextResponse.json({ error: "Restaurant not configured" }, { status: 503 });
  }

  const modeEnabled =
    (input.serviceMode === "delivery" && settings.deliveryEnabled) ||
    (input.serviceMode === "pickup" && settings.pickupEnabled) ||
    (input.serviceMode === "dine_in" && settings.dineInEnabled);
  if (!modeEnabled) {
    return NextResponse.json({ error: "This ordering mode is currently unavailable" }, { status: 400 });
  }

  // ── Load authoritative prices ──────────────────────────────
  const allDbItems = await db.select().from(menuItems);
  const itemById = new Map(allDbItems.map((i) => [i.id, i]));
  const itemBySlug = new Map(allDbItems.map((i) => [i.slug.toLowerCase(), i]));
  const itemByName = new Map(allDbItems.map((i) => [i.name.toLowerCase(), i]));

  const DEMO_ID_TO_SLUG: Record<string, string> = {
    "10000000-0000-4000-8000-000000000001": "royal-dum-biryani",
    "10000000-0000-4000-8000-000000000002": "chicken-biryani",
    "10000000-0000-4000-8000-000000000003": "vegetable-biryani",
    "10000000-0000-4000-8000-000000000004": "seekh-kebab-platter",
    "10000000-0000-4000-8000-000000000005": "reshmi-kebab",
    "10000000-0000-4000-8000-000000000006": "paneer-tikka",
    "10000000-0000-4000-8000-000000000007": "nihari",
    "10000000-0000-4000-8000-000000000008": "garlic-naan",
    "10000000-0000-4000-8000-000000000009": "shahi-tukda",
  };

  const resolveMenuItem = (line: (typeof input.items)[number]) => {
    if (uuidRe.test(line.menuItemId) && itemById.has(line.menuItemId)) {
      return itemById.get(line.menuItemId);
    }
    const mappedSlug = DEMO_ID_TO_SLUG[line.menuItemId];
    if (mappedSlug && itemBySlug.has(mappedSlug)) {
      return itemBySlug.get(mappedSlug);
    }
    const strippedSlug = line.menuItemId.replace(/^item-/, "").toLowerCase();
    if (itemBySlug.has(strippedSlug)) {
      return itemBySlug.get(strippedSlug);
    }
    if (line.name && itemByName.has(line.name.toLowerCase())) {
      return itemByName.get(line.name.toLowerCase());
    }
    return undefined;
  };

  const resolvedItemIds = [
    ...new Set(
      input.items
        .map((l) => resolveMenuItem(l)?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const variants = resolvedItemIds.length
    ? await db.select().from(itemVariants).where(inArray(itemVariants.menuItemId, resolvedItemIds))
    : [];
  const groups = resolvedItemIds.length
    ? await db.select().from(addOnGroups).where(inArray(addOnGroups.menuItemId, resolvedItemIds))
    : [];
  const options = groups.length
    ? await db.select().from(addOnOptions).where(inArray(addOnOptions.groupId, groups.map((g) => g.id)))
    : [];

  type Line = typeof orderItems.$inferInsert;
  const lines: Omit<Line, "orderId">[] = [];
  let subtotal = 0;

  for (const line of input.items) {
    const item = resolveMenuItem(line);
    if (!item || item.status !== "available") {
      return NextResponse.json(
        { error: `${item?.name ?? line.name ?? "An item"} is no longer available` },
        { status: 409 }
      );
    }

    const itemVariantsList = variants.filter((v) => v.menuItemId === item.id);
    let unit = item.pricePaise;
    let variantName: string | null = null;
    if (itemVariantsList.length > 0) {
      const v = line.variantId
        ? itemVariantsList.find((x) => x.id === line.variantId) ??
          (line.variantName
            ? itemVariantsList.find((x) => x.name.toLowerCase() === line.variantName!.toLowerCase())
            : undefined) ??
          (line.variantId.endsWith("-half")
            ? itemVariantsList.find((x) => x.name.toLowerCase().includes("half"))
            : line.variantId.endsWith("-full")
            ? itemVariantsList.find((x) => x.name.toLowerCase().includes("full"))
            : undefined) ??
          itemVariantsList.find((x) => x.isDefault) ??
          itemVariantsList[0]
        : itemVariantsList.find((x) => x.isDefault) ?? itemVariantsList[0];
      if (!v) return NextResponse.json({ error: `Invalid size for ${item.name}` }, { status: 400 });
      unit = v.pricePaise;
      variantName = v.name;
    }

    const itemGroups = groups.filter((g) => g.menuItemId === item.id);
    const chosen = [...new Set(line.addOnOptionIds)].map((id) => options.find((o) => o.id === id));
    if (chosen.some((o) => !o || !itemGroups.some((g) => g.id === o.groupId))) {
      return NextResponse.json({ error: `Invalid add-on for ${item.name}` }, { status: 400 });
    }
    for (const g of itemGroups) {
      const n = chosen.filter((o) => o!.groupId === g.id).length;
      if (n > g.maxSelect || n < Math.max(g.minSelect, g.isRequired ? 1 : 0)) {
        return NextResponse.json({ error: `Check "${g.name}" options for ${item.name}` }, { status: 400 });
      }
    }
    const addOnTotal = chosen.reduce((s, o) => s + o!.pricePaise, 0);

    const total = (unit + addOnTotal) * line.quantity;
    subtotal += total;
    lines.push({
      menuItemId: item.id,
      variantId: itemVariantsList.length ? itemVariantsList.find((v) => v.name === variantName)?.id ?? null : null,
      name: item.name,
      variantName,
      unitPricePaise: unit + addOnTotal,
      quantity: line.quantity,
      totalPaise: total,
      addOns: chosen.map((o) => ({ name: o!.name, pricePaise: o!.pricePaise })),
      specialInstructions: line.note ?? null,
    });
  }

  if (input.serviceMode === "delivery" && subtotal < settings.minimumOrderPaise) {
    return NextResponse.json(
      { error: `Minimum order for delivery is ₹${settings.minimumOrderPaise / 100}` },
      { status: 400 }
    );
  }

  // ── Category Offer / Coupon Discount & GST ─────────────────
  let discount = 0;
  if (input.couponCode) {
    try {
      const cleanCode = input.couponCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleanCode) {
        const [activeOffer] = await db
          .select()
          .from(offers)
          .where(and(eq(offers.code, cleanCode), eq(offers.isActive, true)))
          .limit(1);

        if (activeOffer) {
          const eligibleSubtotal = lines.reduce((sum, l) => {
            if (!activeOffer.categoryId) return sum + l.totalPaise;
            const dbItem = l.menuItemId ? itemById.get(l.menuItemId) : undefined;
            if (dbItem && dbItem.categoryId === activeOffer.categoryId) {
              return sum + l.totalPaise;
            }
            return sum;
          }, 0);

          discount = Math.round((eligibleSubtotal * activeOffer.discountPct) / 100);
        }
      }
    } catch {
      /* ignore if offers table not migrated yet */
    }
  }

  let deliveryFee = 0;
  if (input.serviceMode === "delivery") {
    const free = settings.freeDeliveryAbovePaise;
    deliveryFee = free != null && subtotal >= free ? 0 : settings.deliveryFeePaise;
  }
  const gstRate = Number(settings.gstRatePct);
  const taxableAmount = Math.max(0, subtotal - discount) + deliveryFee;
  const tax = Math.round((taxableAmount * gstRate) / 100);
  const total = Math.max(0, subtotal - discount) + deliveryFee + tax;

  // ── Dine-in table + session ────────────────────────────────
  let tableId: string | null = null;
  let tableSessionId: string | null = null;
  if (input.serviceMode === "dine_in") {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.qrToken, input.tableToken!), eq(restaurantTables.isActive, true)))
      .limit(1);
    if (!table) return NextResponse.json({ error: "Invalid table QR code" }, { status: 400 });
    tableId = table.id;

    const [open] = await db
      .select()
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.status, "open"),
          gt(tableSessions.expiresAt, new Date())
        )
      )
      .limit(1);
    if (open) {
      tableSessionId = open.id;
    } else {
      const [created] = await db
        .insert(tableSessions)
        .values({ tableId: table.id, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) })
        .returning();
      tableSessionId = created.id;
    }
  }

  // Dine-in always pays at counter; delivery/pickup can choose Razorpay if configured
  const rzpKeyId = settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "";
  const rzpKeySecret = settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || "";
  const hasRealRazorpayKeys =
    Boolean(rzpKeyId && rzpKeySecret) &&
    !rzpKeyId.includes("placeholder") &&
    !rzpKeySecret.includes("placeholder");
  const wantsRazorpay =
    input.serviceMode !== "dine_in" && input.paymentMethod === "razorpay";

  if (wantsRazorpay && !hasRealRazorpayKeys) {
    return NextResponse.json(
      { error: "Online payment is not configured yet. Please select Cash/Pay at Counter." },
      { status: 400 }
    );
  }

  const paymentMethod: "razorpay" | "cash_on_delivery" | "pay_at_counter" = wantsRazorpay
    ? "razorpay"
    : input.serviceMode === "delivery"
    ? "cash_on_delivery"
    : "pay_at_counter";

  const paymentStatus = wantsRazorpay ? "pending" : "pay_at_counter";

  // ── Persist ────────────────────────────────────────────────
  let order: typeof orders.$inferSelect | undefined;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await db.transaction(async (tx) => {
        const [o] = await tx
          .insert(orders)
          .values({
            orderNumber: makeOrderNumber(),
            serviceMode: input.serviceMode,
            tableId,
            tableSessionId,
            deliveryAddress: input.serviceMode === "delivery" ? input.address : null,
            guestName: input.guest.name,
            guestPhone: input.guest.phone,
            guestEmail: input.guest.email || null,
            subtotalPaise: subtotal,
            deliveryFeePaise: deliveryFee,
            discountPaise: discount,
            taxPaise: tax,
            gstRatePct: settings.gstRatePct,
            totalPaise: total,
            paymentStatus,
            paymentMethod,
            specialInstructions: input.specialInstructions ?? null,
          })
          .returning();
        await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: o.id })));
        return o;
      });
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  if (!order) return NextResponse.json({ error: "Could not place order" }, { status: 500 });

  // If Razorpay online payment was requested, create the Razorpay order before broadcasting
  if (wantsRazorpay) {
    try {
      const razorpay = new Razorpay({ key_id: rzpKeyId, key_secret: rzpKeySecret });
      const rzpOrder = await razorpay.orders.create({
        amount: total,
        currency: "INR",
        receipt: order.orderNumber,
        notes: { orderId: order.id, serviceMode: order.serviceMode },
      });

      await db.insert(paymentRecords).values({
        orderId: order.id,
        idempotencyKey: randomUUID(),
        razorpayOrderId: rzpOrder.id,
        amountPaise: total,
        currency: "INR",
        status: "pending",
      });

      return NextResponse.json(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          subtotalPaise: subtotal,
          deliveryFeePaise: deliveryFee,
          taxPaise: tax,
          gstRatePct: gstRate,
          totalPaise: total,
          razorpay: {
            keyId: rzpKeyId,
            razorpayOrderId: rzpOrder.id,
            amountPaise: total,
            currency: "INR",
          },
        },
        { status: 201 }
      );
    } catch {
      return NextResponse.json(
        { error: "Failed to initialize Razorpay payment. Please try Cash on Delivery." },
        { status: 502 }
      );
    }
  }

  const ssePayload = await buildDashboardOrderPayload(order.id);
  if (ssePayload) {
    pushOrderEvent("new_order", ssePayload);
  }

  return NextResponse.json(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      subtotalPaise: subtotal,
      deliveryFeePaise: deliveryFee,
      taxPaise: tax,
      gstRatePct: gstRate,
      totalPaise: total,
    },
    { status: 201 }
  );
}
