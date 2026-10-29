"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { ACTIVE_COUPON_KEY, type PublicOffer } from "@/components/public/OffersPopup";
import type { StoreAvailabilityResult } from "@/lib/store-hours";
import styles from "./checkout.module.css";

interface Cfg {
  restaurantName: string;
  gstRatePct: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minimumOrderPaise: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  estimatedDeliveryTime: string;
  estimatedPickupTime: string;
  onlinePaymentEnabled: boolean;
}
type Mode = "delivery" | "pickup" | "dine_in";
type PayChoice = "offline" | "razorpay";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpaySdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CheckoutClient({ cfg }: { cfg: Cfg }) {
  const router = useRouter();
  const { lines, subtotalPaise, tableToken, add, remove, clear, setTableToken } = useCart();

  const [tables, setTables] = useState<
    { id: string; name: string; capacity: number; qrToken: string }[]
  >([]);

  const modes: { id: Mode; label: string; on: boolean }[] = [
    { id: "delivery", label: "🛵 Delivery", on: cfg.deliveryEnabled },
    { id: "pickup", label: "🏃 Pickup", on: cfg.pickupEnabled },
    { id: "dine_in", label: "🪑 Dine-in", on: cfg.dineInEnabled },
  ];
  const available = modes.filter((m) => m.on);
  const [onlineSubMode, setOnlineSubMode] = useState<"delivery" | "pickup">(
    cfg.deliveryEnabled ? "delivery" : "pickup"
  );
  const mode: Mode =
    tableToken && cfg.dineInEnabled
      ? "dine_in"
      : available.some((m) => m.id === onlineSubMode)
      ? onlineSubMode
      : (available[0]?.id ?? "pickup");

  const [payChoice, setPayChoice] = useState<PayChoice>(
    cfg.onlinePaymentEnabled ? "razorpay" : "offline"
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);

  const [form, setForm] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const savedGuest = window.localStorage.getItem("md_guest_info");
        if (savedGuest) {
          const g = JSON.parse(savedGuest) as {
            name?: string;
            phone?: string;
            email?: string;
            line1?: string;
            city?: string;
            pincode?: string;
          };
          return {
            name: g.name || "",
            phone: g.phone || "",
            email: g.email || "",
            line1: g.line1 || "",
            line2: "",
            landmark: "",
            city: g.city || "Mumbai",
            pincode: g.pincode || "",
            notes: "",
          };
        }
      } catch {
        /* ignore */
      }
    }
    return {
      name: "",
      phone: "",
      email: "",
      line1: "",
      line2: "",
      landmark: "",
      city: "Mumbai",
      pincode: "",
      notes: "",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [storeStatus, setStoreStatus] = useState<StoreAvailabilityResult | null>(null);
  const [couponCode, setCouponCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(ACTIVE_COUPON_KEY) || "";
      } catch {
        return "";
      }
    }
    return "";
  });

  useEffect(() => {
    fetch("/api/offers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.offers)) setOffers(d.offers);
      })
      .catch(() => {});

    fetch("/api/tables", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.tables)) setTables(d.tables);
      })
      .catch(() => {});

    fetch("/api/store-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: StoreAvailabilityResult) => {
        if (d && typeof d.isOpenNow === "boolean") setStoreStatus(d);
      })
      .catch(() => {});

    const onApplied = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) setCouponCode(code);
    };
    window.addEventListener("md_coupon_applied", onApplied);
    return () => window.removeEventListener("md_coupon_applied", onApplied);
  }, []);

  function handleDetectLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocMsg("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocMsg("Detecting your GPS coordinates…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setCoords({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const streetParts = [
              addr.house_number,
              addr.building,
              addr.road || addr.pedestrian,
              addr.neighbourhood || addr.suburb,
            ].filter(Boolean);
            const detectedLine1 =
              streetParts.join(", ") ||
              (typeof data.display_name === "string"
                ? data.display_name.split(",").slice(0, 3).join(",").trim()
                : "");
            const detectedCity =
              addr.city || addr.town || addr.village || addr.state_district || "Mumbai";
            const detectedPin =
              typeof addr.postcode === "string"
                ? addr.postcode.replace(/\D/g, "").slice(0, 6)
                : "";

            setForm((prev) => ({
              ...prev,
              line1: detectedLine1 || prev.line1,
              city: detectedCity || prev.city,
              pincode: detectedPin.length === 6 ? detectedPin : prev.pincode,
            }));
            setLocMsg(`✓ Exact GPS pin locked (${lat}, ${lng}) & address filled!`);
          } else {
            setLocMsg(`✓ Exact GPS pin locked (${lat}, ${lng})!`);
          }
        } catch {
          setLocMsg(`✓ Exact GPS pin locked (${lat}, ${lng})!`);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocMsg("Location permission denied or unavailable. Please type your address below.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const matchedOffer = offers.find(
    (o) => o.code.toUpperCase() === couponCode.trim().toUpperCase()
  );
  const eligibleSubtotalPaise = matchedOffer
    ? !matchedOffer.categoryId
      ? subtotalPaise
      : lines.reduce((sum, l) => {
          const byId = matchedOffer.eligibleItemIds?.includes(l.itemId);
          const byName = matchedOffer.eligibleItemNames?.includes(l.name.toLowerCase());
          return byId || byName ? sum + l.unitPricePaise * l.quantity : sum;
        }, 0)
    : 0;
  const discountPaise = matchedOffer
    ? Math.round((eligibleSubtotalPaise * matchedOffer.discountPct) / 100)
    : 0;

  // Display-only math; the server recomputes and is the source of truth.
  const free = cfg.freeDeliveryAbovePaise;
  const deliveryFee =
    mode === "delivery"
      ? free != null && subtotalPaise >= free
        ? 0
        : cfg.deliveryFeePaise
      : 0;
  const taxable = Math.max(0, subtotalPaise - discountPaise) + deliveryFee;
  const tax = Math.round((taxable * cfg.gstRatePct) / 100);
  const total = Math.max(0, subtotalPaise - discountPaise) + deliveryFee + tax;
  const belowMin = mode === "delivery" && subtotalPaise < cfg.minimumOrderPaise;

  const effectivePaymentMethod =
    mode === "dine_in"
      ? "pay_at_counter"
      : cfg.onlinePaymentEnabled && payChoice === "razorpay"
      ? "razorpay"
      : mode === "delivery"
      ? "cash_on_delivery"
      : "pay_at_counter";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanPhone = form.phone.replace(/[\s\-()]/g, "");
    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }
    if (mode === "delivery") {
      if (form.line1.trim().length < 3) {
        setError("Please enter your flat / building / street address.");
        return;
      }
      if (form.city.trim().length < 2) {
        setError("Please enter your city.");
        return;
      }
      if (!/^\d{6}$/.test(form.pincode.replace(/\s+/g, ""))) {
        setError("Please enter a valid 6-digit pincode (e.g. 400003).");
        return;
      }
    }

    setBusy(true);
    try {
      try {
        window.localStorage.setItem(
          "md_guest_info",
          JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email,
            line1: form.line1,
            city: form.city,
            pincode: form.pincode,
          })
        );
      } catch {
        /* ignore */
      }
      const effectiveTableToken =
        mode === "dine_in"
          ? tableToken || tables[0]?.qrToken || "dine-in-table-1-token"
          : undefined;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceMode: mode,
          paymentMethod: effectivePaymentMethod,
          couponCode: couponCode.trim() || undefined,
          items: lines.map((l) => ({
            menuItemId: l.itemId,
            name: l.name,
            variantId: l.variantId ?? undefined,
            variantName: l.variantName ?? undefined,
            quantity: l.quantity,
          })),
          guest: {
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
          },
          address:
            mode === "delivery"
              ? {
                  line1: form.line1,
                  line2: form.line2 || undefined,
                  landmark: form.landmark || undefined,
                  city: form.city,
                  pincode: form.pincode,
                  ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
                }
              : undefined,
          tableToken: effectiveTableToken,
          specialInstructions: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not place order. Please check your details.");
        return;
      }

      try {
        const rawIds = window.localStorage.getItem("md_order_ids");
        const prevIds: string[] = rawIds ? JSON.parse(rawIds) : [];
        if (data.orderId && !prevIds.includes(data.orderId)) {
          window.localStorage.setItem(
            "md_order_ids",
            JSON.stringify([data.orderId, ...prevIds].slice(0, 50))
          );
        }
      } catch {
        /* ignore */
      }

      if (data.razorpay) {
        const loaded = await loadRazorpaySdk();
        if (!loaded || !window.Razorpay) {
          setError("Could not load Razorpay checkout. Please try again.");
          return;
        }
        const rzp = new window.Razorpay({
          key: data.razorpay.keyId,
          amount: data.razorpay.amountPaise,
          currency: data.razorpay.currency,
          name: cfg.restaurantName,
          description: `Order ${data.orderNumber}`,
          order_id: data.razorpay.razorpayOrderId,
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true,
          },
          prefill: {
            name: form.name,
            contact: `+91${cleanPhone.slice(-10)}`,
            email: form.email || "guest@mughaldarbaar.in",
          },
          handler: async (resp: RazorpayResponse) => {
            const vRes = await fetch(`/api/orders/${data.orderId}/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              }),
            });
            if (vRes.ok) {
              clear();
              router.push(`/order/${data.orderId}`);
            } else {
              setError("Payment signature verification failed. Please contact the restaurant.");
            }
          },
        });
        rzp.open();
        return;
      }

      clear();
      router.push(`/order/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <main className={styles.wrap}>
        <div className={styles.empty}>
          <p>Your cart is empty.</p>
          <Link href="/menu" className="btn btn--primary">Browse Menu</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Checkout</h1>
      <div className={styles.grid}>
        <form onSubmit={submit} noValidate className={styles.card}>
          <div role="radiogroup" aria-label="Order type" className={styles.modes}>
            {available.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className={`${styles.mode} ${mode === m.id ? styles.modeOn : ""}`}
                onClick={() => {
                  if (m.id === "dine_in") {
                    if (!tableToken) {
                      setTableToken(tables[0]?.qrToken || "dine-in-table-1-token");
                    }
                  } else {
                    setOnlineSubMode(m.id);
                    setTableToken(null);
                  }
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "dine_in" && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "#FFFBEB",
                border: "1px solid #F59E0B",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#92400E" }}>
                  🪑 Dine-in Table Order — Final bill paid at counter after your meal.
                </span>
                {tables.length > 0 && (
                  <select
                    aria-label="Select your table"
                    value={tableToken || tables[0]?.qrToken || ""}
                    onChange={(e) => setTableToken(e.target.value)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: "1px solid #D97706",
                      background: "#FFFFFF",
                      color: "#92400E",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.qrToken}>
                        {t.name} ({t.capacity} seats)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          <p className={styles.note}>
            {mode === "delivery" && `Estimated delivery: ${cfg.estimatedDeliveryTime}.`}
            {mode === "pickup" && `Ready in ${cfg.estimatedPickupTime}.`}
          </p>

          <label className="form-label" htmlFor="co-name">Name *</label>
          <input id="co-name" className="form-input" required minLength={2} value={form.name} onChange={set("name")} placeholder="Your full name" autoComplete="name" />
          <label className="form-label" htmlFor="co-phone">Mobile number *</label>
          <input id="co-phone" className="form-input" required type="tel" inputMode="numeric" placeholder="9876543210" value={form.phone} onChange={set("phone")} autoComplete="tel" />
          <label className="form-label" htmlFor="co-email">Email (optional)</label>
          <input id="co-email" className="form-input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />

          {mode === "delivery" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <label className="form-label" htmlFor="co-l1" style={{ margin: 0 }}>
                  Delivery Address *
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={locating}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #2563EB",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: locating ? "wait" : "pointer",
                  }}
                >
                  📍 {locating ? "Detecting GPS…" : "Use My Current Location (Free GPS)"}
                </button>
              </div>
              {locMsg && (
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: coords ? "#059669" : "#B45309",
                    fontWeight: 600,
                    margin: "0.25rem 0",
                  }}
                >
                  {locMsg}
                </p>
              )}
              {coords && (
                <div
                  style={{
                    width: "100%",
                    height: 155,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--color-border)",
                    marginBottom: "0.5rem",
                  }}
                >
                  <iframe
                    title="Your Delivery Location Map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      coords.lng - 0.004
                    }%2C${coords.lat - 0.003}%2C${coords.lng + 0.004}%2C${
                      coords.lat + 0.003
                    }&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                  />
                </div>
              )}
              <input id="co-l1" className="form-input" required value={form.line1} onChange={set("line1")} placeholder="Flat / building / street" autoComplete="address-line1" />
              <input aria-label="Address line 2" className="form-input" value={form.line2} onChange={set("line2")} placeholder="Area (optional)" autoComplete="address-line2" />
              <input aria-label="Landmark" className="form-input" value={form.landmark} onChange={set("landmark")} placeholder="Landmark (optional)" />
              <div className={styles.row}>
                <input aria-label="City" className="form-input" required value={form.city} onChange={set("city")} placeholder="City" autoComplete="address-level2" />
                <input aria-label="Pincode" className="form-input" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={set("pincode")} placeholder="Pincode (e.g. 400003)" autoComplete="postal-code" />
              </div>
            </>
          )}

          {mode !== "dine_in" && cfg.onlinePaymentEnabled && (
            <>
              <span className="form-label">Payment Method</span>
              <div role="radiogroup" aria-label="Payment method" className={styles.modes}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payChoice === "razorpay"}
                  className={`${styles.mode} ${payChoice === "razorpay" ? styles.modeOn : ""}`}
                  onClick={() => setPayChoice("razorpay")}
                >
                  💳 UPI / Card (Online)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payChoice === "offline"}
                  className={`${styles.mode} ${payChoice === "offline" ? styles.modeOn : ""}`}
                  onClick={() => setPayChoice("offline")}
                >
                  {mode === "delivery" ? "💵 Cash on Delivery" : "🏪 Pay at Counter"}
                </button>
              </div>
            </>
          )}

          <label className="form-label" htmlFor="co-notes">Special instructions</label>
          <textarea id="co-notes" className="form-input" rows={3} maxLength={500} value={form.notes} onChange={set("notes")} />

          {belowMin && (
            <p className={styles.err}>
              Minimum order for Delivery is {rupees(cfg.minimumOrderPaise)}. Add more items or switch to <strong>Pickup</strong> above.
            </p>
          )}
          {storeStatus && !storeStatus.isOpenNow && (
            <div
              role="alert"
              style={{
                padding: "0.9rem 1rem",
                borderRadius: 12,
                background: "#FEF2F2",
                border: "1.5px solid #EF4444",
                color: "#991B1B",
                marginBottom: "0.75rem",
                fontSize: "0.84rem",
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                🔴 {storeStatus.headline}
              </strong>
              <div>{storeStatus.subline}</div>
              <div style={{ marginTop: "0.3rem", fontWeight: 800 }}>
                ⏰ Order Accepting Timings ({storeStatus.todayLabel}):{" "}
                {storeStatus.todayFormattedWindow}
              </div>
            </div>
          )}
          {error && <p className={styles.err} role="alert">{error}</p>}
          <button
            type="submit"
            className="btn btn--primary btn--full btn--lg"
            disabled={busy || belowMin || Boolean(storeStatus && !storeStatus.isOpenNow)}
          >
            {busy
              ? "Processing…"
              : storeStatus && !storeStatus.isOpenNow
              ? `🔴 Restaurant Closed · Opens ${storeStatus.todayFormattedWindow}`
              : effectivePaymentMethod === "razorpay"
              ? `Pay Online · ${rupees(total)}`
              : `Place Order · ${rupees(total)}`}
          </button>
        </form>

        <aside className={styles.card} aria-label="Order summary">
          <h2 className={styles.sub}>Your order</h2>
          {lines.map((l) => (
            <div key={l.key} className={styles.line}>
              <span>
                {l.name}{l.variantName ? ` (${l.variantName})` : ""}
                <span className={styles.qty}>
                  <button type="button" onClick={() => remove(l.key)} aria-label={`Remove one ${l.name}`}>−</button>
                  {l.quantity}
                  <button type="button" onClick={() => add({ itemId: l.itemId, name: l.name, isVegetarian: l.isVegetarian, variantId: l.variantId, variantName: l.variantName, unitPricePaise: l.unitPricePaise })} aria-label={`Add one ${l.name}`}>+</button>
                </span>
              </span>
              <span>{rupees(l.unitPricePaise * l.quantity)}</span>
            </div>
          ))}
          <hr />
          {/* Offer / Coupon Box */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="co-coupon"
              style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem" }}
            >
              🎁 Have a Coupon / Offer Code?
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="co-coupon"
                className="form-input"
                placeholder="Enter code (e.g. BIRYANI20)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                style={{ textTransform: "uppercase", fontFamily: "monospace", fontWeight: 700 }}
              />
              {couponCode && (
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode("");
                    try {
                      window.localStorage.removeItem(ACTIVE_COUPON_KEY);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="btn btn--secondary btn--sm"
                >
                  Clear
                </button>
              )}
            </div>
            {matchedOffer && discountPaise > 0 && (
              <p style={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700, marginTop: "0.35rem" }}>
                ✓ {matchedOffer.code} applied ({matchedOffer.discountPct}% OFF · {matchedOffer.categoryName || "All Items"})
              </p>
            )}
            {matchedOffer && discountPaise === 0 && (
              <p style={{ fontSize: "0.78rem", color: "#B45309", fontWeight: 600, marginTop: "0.35rem" }}>
                ℹ️ Code {matchedOffer.code} gives {matchedOffer.discountPct}% OFF on{" "}
                <strong>{matchedOffer.categoryName}</strong> dishes (none in cart yet).
              </p>
            )}
            {offers.length > 0 && !matchedOffer && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                {offers.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setCouponCode(o.code)}
                    style={{
                      background: "#FEF3C7",
                      color: "#92400E",
                      border: "1px dashed #D97706",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Tap to apply: {o.code} ({o.discountPct}% OFF)
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.line}><span>Subtotal</span><span>{rupees(subtotalPaise)}</span></div>
          {discountPaise > 0 && (
            <div className={styles.line} style={{ color: "#059669", fontWeight: 700 }}>
              <span>Discount ({matchedOffer?.code})</span>
              <span>−{rupees(discountPaise)}</span>
            </div>
          )}
          {mode === "delivery" && <div className={styles.line}><span>Delivery</span><span>{deliveryFee === 0 ? "FREE" : rupees(deliveryFee)}</span></div>}
          <div className={styles.line}><span>GST ({cfg.gstRatePct}%)</span><span>{rupees(tax)}</span></div>
          <div className={`${styles.line} ${styles.total}`}><span>Total</span><span>{rupees(total)}</span></div>
        </aside>
      </div>
    </main>
  );
}
