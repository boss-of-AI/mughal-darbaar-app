// ============================================================
// restaurant.config.ts
// Central branding & config — change this for each new client.
// ============================================================

export const restaurantConfig = {
  // ── Identity ──────────────────────────────────────────────
  name: "Mughal Darbaar",
  tagline: "A Royal Legacy of Flavour",
  description:
    "Experience the grandeur of Mughal cuisine — aromatic biryanis, slow-cooked kebabs, and rich curries crafted with centuries-old recipes in the heart of Mumbai.",
  cuisine: "Mughal / North Indian",
  gstin: "", // Restaurant owner's GSTIN — filled by owner in settings
  fssaiNumber: "", // FSSAI licence number — required before Razorpay live mode

  // ── Contact ───────────────────────────────────────────────
  phone: "+91 98765 43210",
  email: "hello@mughaldarbaar.in",
  address: {
    line1: "12, Nawab Manzil, Mohammad Ali Road",
    line2: "Near Minara Masjid",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400003",
    mapUrl: "https://maps.google.com/?q=Mohammad+Ali+Road+Mumbai",
  },

  // ── Hours ─────────────────────────────────────────────────
  hours: {
    weekdays: "12:00 PM – 11:30 PM",
    weekends: "11:00 AM – 12:00 AM",
    closed: [], // e.g. ["Monday"]
  },

  // ── Service Modes ─────────────────────────────────────────
  services: {
    delivery: true,
    pickup: true,
    dineIn: true,
  },

  // ── Ordering Config ───────────────────────────────────────
  ordering: {
    minimumOrderAmount: 25000, // in paise (₹250)
    estimatedDeliveryTime: "30–45 minutes",
    estimatedPickupTime: "15–20 minutes",
    deliveryFee: 4000, // in paise (₹40) — can be zone-based
    freeDeliveryAbove: 50000, // in paise (₹500)
    gstPercent: "5.00", // Default GST — owner configures in dashboard
  },

  // ── Brand Palette ─────────────────────────────────────────
  brand: {
    primary: "#C41E3A",       // Mughal crimson
    primaryDark: "#8B0000",   // Deep red (hover)
    primaryLight: "#E8304F",  // Lighter red
    gold: "#D4AF37",          // Royal gold
    goldLight: "#F0D060",     // Light gold accent
    background: "#FEFDF8",    // Warm off-white
    surface: "#FFFFFF",       // Pure white cards
    surfaceAlt: "#FDF5E8",    // Warm cream
    dark: "#1A0A0A",          // Near-black with warm tint
    text: "#2C1810",          // Dark warm brown
    textMuted: "#7A5C52",     // Muted warm brown
    textLight: "#B89B8F",     // Light text
    border: "#F0E6D3",        // Warm border
    borderStrong: "#D4C4B0",  // Stronger border
  },

  // ── Fonts ─────────────────────────────────────────────────
  fonts: {
    heading: "'Playfair Display', 'Georgia', serif",
    body: "'Inter', system-ui, sans-serif",
    accent: "'Cormorant Garamond', 'Georgia', serif",
  },

  // ── Social ────────────────────────────────────────────────
  social: {
    instagram: "https://instagram.com/mughaldarbaar",
    facebook: "https://facebook.com/mughaldarbaar",
    zomato: "",
    swiggy: "",
  },

  // ── SEO ───────────────────────────────────────────────────
  seo: {
    siteName: "Mughal Darbaar",
    defaultTitle: "Mughal Darbaar — Authentic Mughal Cuisine in Mumbai",
    titleTemplate: "%s | Mughal Darbaar",
    defaultDescription:
      "Order authentic Mughal food online — biryani, kebabs, curries. Home delivery & pickup from Mohammad Ali Road, Mumbai.",
    twitterHandle: "@mughaldarbaar",
    locale: "en_IN",
    currency: "INR",
  },

  // ── Feature Flags ─────────────────────────────────────────
  features: {
    guestCheckout: true,       // Always allow guest ordering
    userAccounts: true,        // Optional registration
    loyaltyPoints: false,      // Phase 2
    ratingsReviews: false,     // Phase 2
    multiLocation: false,      // Phase 2
  },
} as const;

export type RestaurantConfig = typeof restaurantConfig;
