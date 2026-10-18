// ============================================================
// src/lib/db/schema.ts
// Complete Drizzle ORM schema for the Restaurant SAAS platform
// ============================================================

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["owner", "staff", "customer"]);
export const serviceModeEnum = pgEnum("service_mode", [
  "delivery",
  "pickup",
  "dine_in",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "pay_at_counter",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "razorpay",
  "pay_at_counter",
  "cash_on_delivery",
]);
export const itemStatusEnum = pgEnum("item_status", [
  "available",
  "unavailable",
  "archived",
]);
export const tableSessionStatusEnum = pgEnum("table_session_status", [
  "open",
  "closed",
  "expired",
]);

// ── Restaurant Settings ──────────────────────────────────────

export const restaurantSettings = pgTable("restaurant_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  cuisine: text("cuisine"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),

  // Contact
  phone: text("phone"),
  email: text("email"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  mapUrl: text("map_url"),
  gstin: text("gstin"),
  fssaiNumber: text("fssai_number"),

  // Hours (stored as JSON: { day: { open: "HH:MM", close: "HH:MM", closed: boolean } })
  openingHours: jsonb("opening_hours"),

  // Service modes
  deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  dineInEnabled: boolean("dine_in_enabled").notNull().default(true),

  // Ordering
  minimumOrderPaise: integer("minimum_order_paise").notNull().default(25000),
  deliveryFeePaise: integer("delivery_fee_paise").notNull().default(4000),
  freeDeliveryAbovePaise: integer("free_delivery_above_paise").default(50000),
  estimatedDeliveryTime: text("estimated_delivery_time").default("30–45 minutes"),
  estimatedPickupTime: text("estimated_pickup_time").default("15–20 minutes"),

  // Tax — owner configures in dashboard
  gstRatePct: decimal("gst_rate_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("5.00"),

  // Razorpay credentials (encrypted at rest — stored by owner)
  razorpayKeyId: text("razorpay_key_id"),
  razorpayKeySecret: text("razorpay_key_secret"), // TODO: encrypt before storing

  // Resend (email) credentials
  resendApiKey: text("resend_api_key"),
  notificationEmail: text("notification_email"),

  // Social
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  zomatoUrl: text("zomato_url"),
  swiggyUrl: text("swiggy_url"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Users ─────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("email_verified"),
    phone: text("phone"),
    passwordHash: text("password_hash"), // For owner/staff credentials login
    role: userRoleEnum("role").notNull().default("customer"),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

// Auth.js v5 required tables
export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

// ── Delivery Addresses ────────────────────────────────────────

export const deliveryAddresses = pgTable(
  "delivery_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // For guests, no userId — linked via order
    label: text("label"), // "Home", "Work", etc.
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    city: text("city").notNull(),
    pincode: text("pincode").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("delivery_addresses_user_idx").on(t.userId)]
);

// ── Menu Categories ───────────────────────────────────────────

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("menu_categories_sort_idx").on(t.sortOrder)]
);

// ── Menu Items ────────────────────────────────────────────────

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    imageBlurHash: text("image_blur_hash"),

    // Price in paise (₹1 = 100 paise) to avoid floating point issues
    pricePaise: integer("price_paise").notNull(),

    isVegetarian: boolean("is_vegetarian").notNull().default(false),
    isVegan: boolean("is_vegan").notNull().default(false),
    isGlutenFree: boolean("is_gluten_free").notNull().default(false),
    isSpicy: boolean("is_spicy").notNull().default(false),
    spicyLevel: integer("spicy_level").default(0), // 0-3

    status: itemStatusEnum("status").notNull().default("available"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    // Nutritional info (optional)
    calories: integer("calories"),
    allergens: text("allergens").array(),

    prepTimeMinutes: integer("prep_time_minutes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("menu_items_category_idx").on(t.categoryId),
    index("menu_items_status_idx").on(t.status),
    index("menu_items_featured_idx").on(t.isFeatured),
  ]
);

// ── Item Variants ─────────────────────────────────────────────

export const itemVariants = pgTable("item_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Half", "Full", "Regular", "Large"
  pricePaise: integer("price_paise").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Add-On Groups ─────────────────────────────────────────────

export const addOnGroups = pgTable("add_on_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Extra Sauces", "Bread Choice"
  isRequired: boolean("is_required").notNull().default(false),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const addOnOptions = pgTable("add_on_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => addOnGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Mint Chutney"
  pricePaise: integer("price_paise").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Tables (Dine-In) ──────────────────────────────────────────

export const restaurantTables = pgTable("restaurant_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g. "Table 1", "Window Seat", "VIP Room"
  capacity: integer("capacity").notNull().default(4),
  qrToken: text("qr_token").unique(), // 256-bit random token
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Table Sessions ────────────────────────────────────────────

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => restaurantTables.id),
    status: tableSessionStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
    expiresAt: timestamp("expires_at"), // Auto-expire after 8h
    notes: text("notes"),
  },
  (t) => [
    index("table_sessions_table_idx").on(t.tableId),
    index("table_sessions_status_idx").on(t.status),
  ]
);

// ── Orders ────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(), // Human-readable: MD-2024-001234
    userId: uuid("user_id").references(() => users.id), // null for guests

    serviceMode: serviceModeEnum("service_mode").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),

    // Table info (dine-in only)
    tableId: uuid("table_id").references(() => restaurantTables.id),
    tableSessionId: uuid("table_session_id").references(() => tableSessions.id),

    // Delivery info (delivery mode only)
    deliveryAddressId: uuid("delivery_address_id").references(
      () => deliveryAddresses.id
    ),
    deliveryAddress: jsonb("delivery_address"), // Snapshot at order time

    // Guest info (for guest checkout)
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),

    // Pricing (all in paise — server calculated, never trust browser)
    subtotalPaise: integer("subtotal_paise").notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull().default(0),
    discountPaise: integer("discount_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull(), // GST amount computed at checkout
    gstRatePct: decimal("gst_rate_pct", { precision: 5, scale: 2 }).notNull(), // Snapshot of rate at order time
    totalPaise: integer("total_paise").notNull(),

    // Payment
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    paymentMethod: paymentMethodEnum("payment_method"),

    // Special instructions
    specialInstructions: text("special_instructions"),

    // Timestamps
    estimatedReadyAt: timestamp("estimated_ready_at"),
    acceptedAt: timestamp("accepted_at"),
    readyAt: timestamp("ready_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_created_at_idx").on(t.createdAt),
    index("orders_user_idx").on(t.userId),
    index("orders_table_session_idx").on(t.tableSessionId),
    index("orders_service_mode_idx").on(t.serviceMode),
  ]
);

// ── Order Items ───────────────────────────────────────────────

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").references(() => menuItems.id),
  variantId: uuid("variant_id").references(() => itemVariants.id),

  // Snapshot at order time — menu can change after order
  name: text("name").notNull(),
  variantName: text("variant_name"),
  unitPricePaise: integer("unit_price_paise").notNull(),
  quantity: integer("quantity").notNull().default(1),
  totalPaise: integer("total_paise").notNull(),

  // Add-ons snapshot
  addOns: jsonb("add_ons"), // [{ name, pricePaise }]
  specialInstructions: text("special_instructions"),
});

// ── Payment Records ───────────────────────────────────────────

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    idempotencyKey: text("idempotency_key").notNull().unique(), // Prevents duplicate charges
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpaySignature: text("razorpay_signature"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    webhookReceivedAt: timestamp("webhook_received_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("payment_records_order_idx").on(t.orderId)]
);

// ── Delivery Zones ─────────────────────────────────────────────

export const deliveryZones = pgTable("delivery_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g. "Zone A — 0-3km"
  pincodes: text("pincodes").array().notNull(),
  deliveryFeePaise: integer("delivery_fee_paise").notNull(),
  freeDeliveryAbovePaise: integer("free_delivery_above_paise"),
  estimatedDeliveryTime: text("estimated_delivery_time"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── SSE Events (for live order dashboard) ─────────────────────

export const sseEvents = pgTable(
  "sse_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(), // "new_order" | "order_updated"
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sse_events_created_idx").on(t.createdAt)]
);

// ── Relations ─────────────────────────────────────────────────

export const menuCategoriesRelations = relations(
  menuCategories,
  ({ many }) => ({
    items: many(menuItems),
  })
);

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  variants: many(itemVariants),
  addOnGroups: many(addOnGroups),
  orderItems: many(orderItems),
}));

export const itemVariantsRelations = relations(itemVariants, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemVariants.menuItemId],
    references: [menuItems.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  table: one(restaurantTables, {
    fields: [orders.tableId],
    references: [restaurantTables.id],
  }),
  tableSession: one(tableSessions, {
    fields: [orders.tableSessionId],
    references: [tableSessions.id],
  }),
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id],
  }),
  items: many(orderItems),
  payments: many(paymentRecords),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const restaurantTablesRelations = relations(
  restaurantTables,
  ({ many }) => ({
    sessions: many(tableSessions),
    orders: many(orders),
  })
);

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  table: one(restaurantTables, {
    fields: [tableSessions.tableId],
    references: [restaurantTables.id],
  }),
  orders: many(orders),
}));

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  addresses: many(deliveryAddresses),
  accounts: many(accounts),
  sessions: many(sessions),
}));
