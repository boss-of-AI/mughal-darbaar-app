/**
 * seed.ts — Mughal Darbaar database seed script
 * Run: npm run db:seed
 *
 * Seeds:
 *  - restaurant_settings (branding + GST 5%)
 *  - menu categories (7)
 *  - menu items (25+)
 *  - item variants (half/full for biryanis)
 *  - restaurant tables (10)
 *  - owner user account
 */

import { db } from "./index";
import {
  restaurantSettings,
  menuCategories,
  menuItems,
  itemVariants,
  restaurantTables,
  users,
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding Mughal Darbaar database…\n");

  // ── Clean existing data (dev only) ──────────────────────────
  console.log("🗑  Clearing existing data…");
  await db.execute(sql`TRUNCATE TABLE item_variants, add_on_options, add_on_groups, order_items, orders, payment_records, table_sessions, restaurant_tables, menu_items, menu_categories, restaurant_settings, accounts, sessions, users RESTART IDENTITY CASCADE`);

  // ── Restaurant Settings ──────────────────────────────────────
  console.log("🏠 Inserting restaurant settings…");
  await db.insert(restaurantSettings).values({
    name: "Mughal Darbaar",
    tagline: "A Royal Legacy of Flavour",
    description:
      "Experience the grandeur of Mughal cuisine — aromatic biryanis, slow-cooked kebabs, and rich curries crafted with centuries-old recipes in the heart of Mumbai.",
    cuisine: "Mughal / North Indian",
    phone: "+91 98765 43210",
    email: "hello@mughaldarbaar.in",
    addressLine1: "12, Nawab Manzil, Mohammad Ali Road",
    addressLine2: "Near Minara Masjid",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400003",
    mapUrl: "https://maps.google.com/?q=Mohammad+Ali+Road+Mumbai",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    minimumOrderPaise: 25000,      // ₹250
    deliveryFeePaise: 4000,         // ₹40
    freeDeliveryAbovePaise: 50000,  // ₹500
    estimatedDeliveryTime: "30–45 minutes",
    estimatedPickupTime: "15–20 minutes",
    gstRatePct: "5.00",            // Owner-configurable in dashboard
    notificationEmail: "orders@mughaldarbaar.in",
    instagramUrl: "https://instagram.com/mughaldarbaar",
    facebookUrl: "https://facebook.com/mughaldarbaar",
    openingHours: {
      monday:    { open: "12:00", close: "23:30", closed: false },
      tuesday:   { open: "12:00", close: "23:30", closed: false },
      wednesday: { open: "12:00", close: "23:30", closed: false },
      thursday:  { open: "12:00", close: "23:30", closed: false },
      friday:    { open: "12:00", close: "23:30", closed: false },
      saturday:  { open: "11:00", close: "00:00", closed: false },
      sunday:    { open: "11:00", close: "00:00", closed: false },
    },
  });

  // ── Owner User ───────────────────────────────────────────────
  console.log("👤 Creating owner account…");
  const passwordHash = await bcrypt.hash("Mughal@2024!", 12);
  await db.insert(users).values({
    name: "Mughal Darbaar Owner",
    email: "owner@mughaldarbaar.in",
    passwordHash,
    role: "owner",
    isActive: true,
  });

  // ── Menu Categories ──────────────────────────────────────────
  console.log("📂 Inserting menu categories…");
  const [
    catBiryani,
    catKebabs,
    catCurries,
    catBreads,
    catStarters,
    catDesserts,
    catDrinks,
  ] = await db
    .insert(menuCategories)
    .values([
      {
        name: "Biryanis",
        slug: "biryanis",
        description: "Slow-cooked dum biryanis — the crown jewel of Mughal cuisine.",
        sortOrder: 1,
      },
      {
        name: "Kebabs & Grills",
        slug: "kebabs-grills",
        description: "Charcoal-fired seekh, boti & reshmi kebabs from our tandoor.",
        sortOrder: 2,
      },
      {
        name: "Curries & Gravies",
        slug: "curries-gravies",
        description: "Rich kormas, roganjosh, and royal gravies slow-cooked to perfection.",
        sortOrder: 3,
      },
      {
        name: "Breads",
        slug: "breads",
        description: "Freshly baked naans, rotis, and parathas from our clay tandoor.",
        sortOrder: 4,
      },
      {
        name: "Starters & Snacks",
        slug: "starters-snacks",
        description: "Light bites and street-style snacks to begin your royal feast.",
        sortOrder: 5,
      },
      {
        name: "Desserts",
        slug: "desserts",
        description: "Mughal sweets — phirni, gulab jamun, shahi tukda.",
        sortOrder: 6,
      },
      {
        name: "Drinks",
        slug: "drinks",
        description: "Sharbats, lassi, chai, and chilled beverages.",
        sortOrder: 7,
      },
    ])
    .returning();

  // ── Menu Items ───────────────────────────────────────────────
  console.log("🍛 Inserting menu items…");
  const items = await db
    .insert(menuItems)
    .values([
      // ── Biryanis ─────────────────────────────────────────
      {
        categoryId: catBiryani.id,
        name: "Royal Dum Biryani",
        slug: "royal-dum-biryani",
        description:
          "The flagship dish. Aged basmati rice slow-cooked with tender mutton pieces, saffron, caramelised onions, and a century-old spice blend. Sealed with dough and finished over charcoal.",
        pricePaise: 38000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: true,
        prepTimeMinutes: 45,
        calories: 720,
        sortOrder: 1,
      },
      {
        categoryId: catBiryani.id,
        name: "Chicken Biryani",
        slug: "chicken-biryani",
        description:
          "Tender chicken marinated in yoghurt and Mughal spices, layered with fragrant basmati rice and slow-cooked to perfection.",
        pricePaise: 32000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: false,
        prepTimeMinutes: 40,
        calories: 650,
        sortOrder: 2,
      },
      {
        categoryId: catBiryani.id,
        name: "Vegetable Biryani",
        slug: "vegetable-biryani",
        description:
          "Fresh seasonal vegetables slow-cooked with saffron-laced basmati rice. Rich with whole spices and caramelised onions.",
        pricePaise: 26000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 35,
        calories: 520,
        sortOrder: 3,
      },
      {
        categoryId: catBiryani.id,
        name: "Hyderabadi Biryani",
        slug: "hyderabadi-biryani",
        description:
          "Kachche gosht style — raw marinated mutton cooked with rice simultaneously. More robust spice profile with fried onions and mint.",
        pricePaise: 40000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 3,
        isFeatured: true,
        prepTimeMinutes: 50,
        calories: 750,
        sortOrder: 4,
      },

      // ── Kebabs ───────────────────────────────────────────
      {
        categoryId: catKebabs.id,
        name: "Seekh Kebab Platter",
        slug: "seekh-kebab-platter",
        description:
          "Hand-minced lamb with 14 spices, shaped on iron seekhs and charcoal-grilled. Served with laccha onions, mint chutney & roomali roti.",
        pricePaise: 32000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: true,
        prepTimeMinutes: 20,
        calories: 480,
        sortOrder: 1,
      },
      {
        categoryId: catKebabs.id,
        name: "Chicken Tikka",
        slug: "chicken-tikka",
        description:
          "Succulent boneless chicken marinated in hung curd, ginger-garlic paste, and Kashmiri chillies. Cooked in our tandoor over high heat.",
        pricePaise: 28000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: false,
        prepTimeMinutes: 18,
        calories: 380,
        sortOrder: 2,
      },
      {
        categoryId: catKebabs.id,
        name: "Reshmi Kebab",
        slug: "reshmi-kebab",
        description:
          "Silky smooth minced chicken kebabs blended with cream, cashews, and aromatic spices. Melt-in-the-mouth texture.",
        pricePaise: 30000,
        isVegetarian: false,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 20,
        calories: 420,
        sortOrder: 3,
      },
      {
        categoryId: catKebabs.id,
        name: "Paneer Tikka",
        slug: "paneer-tikka",
        description:
          "Thick-cut paneer cubes marinated in spiced yoghurt, skewered with bell peppers and onions, tandoor-grilled to perfection.",
        pricePaise: 26000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 18,
        calories: 320,
        sortOrder: 4,
      },

      // ── Curries ──────────────────────────────────────────
      {
        categoryId: catCurries.id,
        name: "Shahi Korma",
        slug: "shahi-korma",
        description:
          "Slow-braised chicken in a fragrant almond-cardamom sauce with a velvety finish. The crown jewel of Mughal court cuisine.",
        pricePaise: 36000,
        isVegetarian: false,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: true,
        prepTimeMinutes: 30,
        calories: 580,
        sortOrder: 1,
      },
      {
        categoryId: catCurries.id,
        name: "Mutton Roganjosh",
        slug: "mutton-roganjosh",
        description:
          "Aromatic Kashmiri lamb curry with whole spices, dried ginger, and fiery Kashmiri chillies. Slow-cooked until the meat falls off the bone.",
        pricePaise: 40000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 3,
        isFeatured: false,
        prepTimeMinutes: 45,
        calories: 620,
        sortOrder: 2,
      },
      {
        categoryId: catCurries.id,
        name: "Mughlai Paneer Lababdar",
        slug: "mughlai-paneer-lababdar",
        description:
          "Cottage cheese in a rich, velvety tomato-cashew gravy infused with Kashmiri spices and a swirl of cream.",
        pricePaise: 28000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: true,
        prepTimeMinutes: 25,
        calories: 460,
        sortOrder: 3,
      },
      {
        categoryId: catCurries.id,
        name: "Dal Makhani",
        slug: "dal-makhani",
        description:
          "Whole black lentils slow-cooked overnight with butter, cream, and tomatoes. Rich, indulgent, and deeply comforting.",
        pricePaise: 22000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 20,
        calories: 380,
        sortOrder: 4,
      },
      {
        categoryId: catCurries.id,
        name: "Nihari",
        slug: "nihari",
        description:
          "The royal morning broth. Slow-cooked beef shank with marrow, ginger-garlic, and a blend of 22 spices. A Mughal breakfast tradition.",
        pricePaise: 42000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: true,
        prepTimeMinutes: 60,
        calories: 680,
        sortOrder: 5,
      },

      // ── Breads ───────────────────────────────────────────
      {
        categoryId: catBreads.id,
        name: "Garlic Naan",
        slug: "garlic-naan",
        description:
          "Leavened bread brushed with garlic butter and fresh coriander, baked in our clay tandoor.",
        pricePaise: 5500,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 10,
        calories: 220,
        sortOrder: 1,
      },
      {
        categoryId: catBreads.id,
        name: "Roomali Roti",
        slug: "roomali-roti",
        description:
          "Gossamer thin bread (handkerchief bread) baked on an inverted tawa. The perfect accompaniment to rich gravies.",
        pricePaise: 4500,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 8,
        calories: 140,
        sortOrder: 2,
      },
      {
        categoryId: catBreads.id,
        name: "Sheermal",
        slug: "sheermal",
        description:
          "A saffron-laced slightly sweet flatbread, traditional to Lucknow and Mughal courts. Brushed with ghee.",
        pricePaise: 6000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 12,
        calories: 180,
        sortOrder: 3,
      },
      {
        categoryId: catBreads.id,
        name: "Stuffed Paratha",
        slug: "stuffed-paratha",
        description:
          "Whole wheat flatbread stuffed with spiced potato or paneer, roasted on a tawa with butter.",
        pricePaise: 8000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 12,
        calories: 290,
        sortOrder: 4,
      },

      // ── Starters ─────────────────────────────────────────
      {
        categoryId: catStarters.id,
        name: "Mutton Boti Kebab",
        slug: "mutton-boti-kebab",
        description:
          "Tender mutton cubes marinated in raw papaya paste and spices, skewered and grilled in the tandoor.",
        pricePaise: 34000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: false,
        prepTimeMinutes: 22,
        calories: 440,
        sortOrder: 1,
      },
      {
        categoryId: catStarters.id,
        name: "Hariyali Chicken",
        slug: "hariyali-chicken",
        description:
          "Chicken marinated in a paste of fresh coriander, mint, green chillies, and spices. Vivid green, aromatic, and refreshing.",
        pricePaise: 27000,
        isVegetarian: false,
        isSpicy: true,
        spicyLevel: 2,
        isFeatured: false,
        prepTimeMinutes: 18,
        calories: 360,
        sortOrder: 2,
      },
      {
        categoryId: catStarters.id,
        name: "Veg Shami Kebab",
        slug: "veg-shami-kebab",
        description:
          "Soft chana dal and paneer patties spiced with whole spices and fried golden. A vegetarian classic.",
        pricePaise: 19000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 1,
        isFeatured: false,
        prepTimeMinutes: 15,
        calories: 280,
        sortOrder: 3,
      },

      // ── Desserts ─────────────────────────────────────────
      {
        categoryId: catDesserts.id,
        name: "Phirni",
        slug: "phirni",
        description:
          "Classic Mughal rice pudding set in clay pots, garnished with crushed pistachio and edible silver leaf (varak).",
        pricePaise: 12000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: true,
        prepTimeMinutes: 5,
        calories: 240,
        sortOrder: 1,
      },
      {
        categoryId: catDesserts.id,
        name: "Gulab Jamun",
        slug: "gulab-jamun",
        description:
          "Soft khoya dumplings soaked in rose-flavoured sugar syrup. Served warm. A timeless Indian classic.",
        pricePaise: 10000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 5,
        calories: 280,
        sortOrder: 2,
      },
      {
        categoryId: catDesserts.id,
        name: "Shahi Tukda",
        slug: "shahi-tukda",
        description:
          "Deep-fried bread soaked in saffron-cardamom milk and topped with rabri and dry fruits. A royal dessert.",
        pricePaise: 14000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 8,
        calories: 380,
        sortOrder: 3,
      },

      // ── Drinks ───────────────────────────────────────────
      {
        categoryId: catDrinks.id,
        name: "Rose Sharbat",
        slug: "rose-sharbat",
        description:
          "Chilled rose syrup with milk, basil seeds (sabja), and a hint of cardamom. A classic Mughal cooler.",
        pricePaise: 8000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 3,
        calories: 140,
        sortOrder: 1,
      },
      {
        categoryId: catDrinks.id,
        name: "Sweet Lassi",
        slug: "sweet-lassi",
        description:
          "Thick curd whisked with sugar, cardamom, and a scoop of malai. Cooling and creamy.",
        pricePaise: 9000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 3,
        calories: 180,
        sortOrder: 2,
      },
      {
        categoryId: catDrinks.id,
        name: "Mughal Chai",
        slug: "mughal-chai",
        description:
          "Kahwa-style green tea brewed with saffron, cardamom, cinnamon, and rose petals.",
        pricePaise: 6000,
        isVegetarian: true,
        isSpicy: false,
        spicyLevel: 0,
        isFeatured: false,
        prepTimeMinutes: 5,
        calories: 30,
        sortOrder: 3,
      },
    ])
    .returning();

  // ── Item Variants (for biryanis) ─────────────────────────────
  console.log("📏 Adding biryani variants…");
  const biryanis = items.filter((item) =>
    ["royal-dum-biryani", "chicken-biryani", "vegetable-biryani", "hyderabadi-biryani"].includes(item.slug)
  );

  for (const biryani of biryanis) {
    await db.insert(itemVariants).values([
      {
        menuItemId: biryani.id,
        name: "Half",
        pricePaise: Math.round(biryani.pricePaise * 0.6),
        isDefault: false,
        sortOrder: 1,
      },
      {
        menuItemId: biryani.id,
        name: "Full",
        pricePaise: biryani.pricePaise,
        isDefault: true,
        sortOrder: 2,
      },
    ]);
  }

  // ── Restaurant Tables ────────────────────────────────────────
  console.log("🪑 Creating restaurant tables…");
  await db.insert(restaurantTables).values([
    { name: "Table 1", capacity: 2, sortOrder: 1, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 2", capacity: 2, sortOrder: 2, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 3", capacity: 4, sortOrder: 3, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 4", capacity: 4, sortOrder: 4, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 5", capacity: 4, sortOrder: 5, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 6", capacity: 6, sortOrder: 6, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Table 7", capacity: 6, sortOrder: 7, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "VIP Room",  capacity: 10, sortOrder: 8, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Terrace 1", capacity: 4, sortOrder: 9, qrToken: `table-qr-${crypto.randomUUID()}` },
    { name: "Terrace 2", capacity: 4, sortOrder: 10, qrToken: `table-qr-${crypto.randomUUID()}` },
  ]);

  console.log("\n✅ Seed complete!\n");
  console.log("📌 Login credentials:");
  console.log("   Email:    owner@mughaldarbaar.in");
  console.log("   Password: Mughal@2024!");
  console.log("   Role:     owner\n");
  console.log(`🍛 ${items.length} menu items inserted across 7 categories`);
  console.log("🪑 10 tables created");
  console.log("⚙️  GST rate: 5%\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
