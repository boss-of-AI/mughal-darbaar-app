"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
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
  const { lines, subtotalPaise, tableToken, add, remove, clear } = useCart();

  const modes: { id: Mode; label: string; on: boolean }[] = [
    { id: "delivery", label: "🛵 Delivery", on: cfg.deliveryEnabled && !tableToken },
    { id: "pickup", label: "🏃 Pickup", on: cfg.pickupEnabled && !tableToken },
    { id: "dine_in", label: "🪑 Dine-in", on: cfg.dineInEnabled && !!tableToken },
  ];
  const available = modes.filter((m) => m.on);
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode: Mode = tableToken
    ? "dine_in"
    : picked && available.some((m) => m.id === picked)
    ? picked
    : (available[0]?.id ?? "pickup");

  const [payChoice, setPayChoice] = useState<PayChoice>(
    cfg.onlinePaymentEnabled ? "razorpay" : "offline"
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    line1: "",
    line2: "",
    landmark: "",
    city: "Mumbai",
    pincode: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // Display-only math; the server recomputes and is the source of truth.
  const free = cfg.freeDeliveryAbovePaise;
  const deliveryFee =
    mode === "delivery"
      ? free != null && subtotalPaise >= free
        ? 0
        : cfg.deliveryFeePaise
      : 0;
  const tax = Math.round(((subtotalPaise + deliveryFee) * cfg.gstRatePct) / 100);
  const total = subtotalPaise + deliveryFee + tax;
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
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceMode: mode,
          paymentMethod: effectivePaymentMethod,
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
                }
              : undefined,
          tableToken: mode === "dine_in" ? (tableToken ?? undefined) : undefined,
          specialInstructions: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not place order. Please check your details.");
        return;
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
          {tableToken ? (
            <p className={styles.note}>🪑 Dine-in order — pay at the counter after your meal.</p>
          ) : (
            <div role="radiogroup" aria-label="Order type" className={styles.modes}>
              {available.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={`${styles.mode} ${mode === m.id ? styles.modeOn : ""}`}
                  onClick={() => setPicked(m.id)}
                >
                  {m.label}
                </button>
              ))}
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
              <label className="form-label" htmlFor="co-l1">Address *</label>
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
          {error && <p className={styles.err} role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={busy || belowMin}>
            {busy
              ? "Processing…"
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
          <div className={styles.line}><span>Subtotal</span><span>{rupees(subtotalPaise)}</span></div>
          {mode === "delivery" && <div className={styles.line}><span>Delivery</span><span>{deliveryFee === 0 ? "FREE" : rupees(deliveryFee)}</span></div>}
          <div className={styles.line}><span>GST ({cfg.gstRatePct}%)</span><span>{rupees(tax)}</span></div>
          <div className={`${styles.line} ${styles.total}`}><span>Total</span><span>{rupees(total)}</span></div>
        </aside>
      </div>
    </main>
  );
}
