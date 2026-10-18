"use client";

import { useState } from "react";
import { Save, CheckCircle } from "lucide-react";
import styles from "./settings.module.css";

export interface InitialSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  gstin: string;
  fssaiNumber: string;
  gstRatePct: number;
  minimumOrderRupees: number;
  deliveryFeeRupees: number;
  freeDeliveryAboveRupees: number;
  estimatedDeliveryTime: string;
  estimatedPickupTime: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  razorpayKeyId: string;
  hasRazorpaySecret: boolean;
}

export default function SettingsClient({ initial }: { initial: InitialSettings }) {
  const [form, setForm] = useState({
    ...initial,
    razorpayKeySecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tagline: form.tagline,
          phone: form.phone,
          email: form.email,
          gstin: form.gstin,
          fssaiNumber: form.fssaiNumber,
          gstRatePct: Number(form.gstRatePct),
          minimumOrderPaise: Math.round(Number(form.minimumOrderRupees) * 100),
          deliveryFeePaise: Math.round(Number(form.deliveryFeeRupees) * 100),
          freeDeliveryAbovePaise:
            Number(form.freeDeliveryAboveRupees) > 0
              ? Math.round(Number(form.freeDeliveryAboveRupees) * 100)
              : null,
          estimatedDeliveryTime: form.estimatedDeliveryTime,
          estimatedPickupTime: form.estimatedPickupTime,
          deliveryEnabled: form.deliveryEnabled,
          pickupEnabled: form.pickupEnabled,
          dineInEnabled: form.dineInEnabled,
          razorpayKeyId: form.razorpayKeyId || undefined,
          razorpayKeySecret: form.razorpayKeySecret || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not save settings");
        return;
      }
      setSavedMsg("Settings saved! Menu & checkout pages updated.");
      setForm((f) => ({
        ...f,
        hasRazorpaySecret: f.hasRazorpaySecret || Boolean(f.razorpayKeySecret),
        razorpayKeySecret: "",
      }));
    } catch {
      setErrorMsg("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Restaurant Settings</h1>
          <p className={styles.subtitle}>
            Configure GST %, delivery charges, active ordering modes, and payment credentials.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Tax & GST Section */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>GST &amp; Tax Configuration</h2>
          <p className={styles.sectionHint}>
            Set the GST percentage added to customer orders at checkout. Applied server-side on (Subtotal + Delivery Fee).
          </p>
          <div className={styles.grid3}>
            <div>
              <label className="form-label" htmlFor="set-gst">GST Percentage (%) *</label>
              <input
                id="set-gst"
                type="number"
                step="0.01"
                min={0}
                max={28}
                required
                className="form-input"
                value={form.gstRatePct}
                onChange={(e) => setForm((f) => ({ ...f, gstRatePct: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-gstin">GSTIN (Optional)</label>
              <input
                id="set-gstin"
                className="form-input"
                placeholder="27XXXXX0000X1Z5"
                value={form.gstin}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-fssai">FSSAI No. (Optional)</label>
              <input
                id="set-fssai"
                className="form-input"
                placeholder="Optional"
                value={form.fssaiNumber}
                onChange={(e) => setForm((f) => ({ ...f, fssaiNumber: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Ordering Modes & Delivery Fees */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Ordering Modes &amp; Delivery Charges</h2>
          <div className={styles.toggleRow}>
            <label className={styles.toggleItem}>
              <input
                type="checkbox"
                checked={form.deliveryEnabled}
                onChange={(e) => setForm((f) => ({ ...f, deliveryEnabled: e.target.checked }))}
              />
              <span>🛵 Home Delivery</span>
            </label>
            <label className={styles.toggleItem}>
              <input
                type="checkbox"
                checked={form.pickupEnabled}
                onChange={(e) => setForm((f) => ({ ...f, pickupEnabled: e.target.checked }))}
              />
              <span>🏃 Takeaway / Pickup</span>
            </label>
            <label className={styles.toggleItem}>
              <input
                type="checkbox"
                checked={form.dineInEnabled}
                onChange={(e) => setForm((f) => ({ ...f, dineInEnabled: e.target.checked }))}
              />
              <span>🪑 QR Dine-In (Pay at Counter)</span>
            </label>
          </div>

          <div className={styles.grid3}>
            <div>
              <label className="form-label" htmlFor="set-min">Minimum Delivery Order (₹)</label>
              <input
                id="set-min"
                type="number"
                min={0}
                required
                className="form-input"
                value={form.minimumOrderRupees}
                onChange={(e) => setForm((f) => ({ ...f, minimumOrderRupees: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-dfee">Delivery Fee (₹)</label>
              <input
                id="set-dfee"
                type="number"
                min={0}
                required
                className="form-input"
                value={form.deliveryFeeRupees}
                onChange={(e) => setForm((f) => ({ ...f, deliveryFeeRupees: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-free">Free Delivery Above (₹, 0 = off)</label>
              <input
                id="set-free"
                type="number"
                min={0}
                required
                className="form-input"
                value={form.freeDeliveryAboveRupees}
                onChange={(e) =>
                  setForm((f) => ({ ...f, freeDeliveryAboveRupees: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div>
              <label className="form-label" htmlFor="set-dtime">Estimated Delivery Time</label>
              <input
                id="set-dtime"
                className="form-input"
                value={form.estimatedDeliveryTime}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDeliveryTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-ptime">Estimated Pickup Time</label>
              <input
                id="set-ptime"
                className="form-input"
                value={form.estimatedPickupTime}
                onChange={(e) => setForm((f) => ({ ...f, estimatedPickupTime: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Restaurant Profile */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Restaurant Profile</h2>
          <div className={styles.grid2}>
            <div>
              <label className="form-label" htmlFor="set-name">Restaurant Name *</label>
              <input
                id="set-name"
                className="form-input"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-tagline">Tagline</label>
              <input
                id="set-tagline"
                className="form-input"
                value={form.tagline}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-phone">Contact Phone</label>
              <input
                id="set-phone"
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-email">Contact Email</label>
              <input
                id="set-email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Razorpay Credentials */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Razorpay Merchant Keys (Owner Account)</h2>
          <p className={styles.sectionHint}>
            Each restaurant uses its own Razorpay account. Dine-in orders always pay at the counter.
          </p>
          <div className={styles.grid2}>
            <div>
              <label className="form-label" htmlFor="set-rzp-id">Razorpay Key ID</label>
              <input
                id="set-rzp-id"
                className="form-input"
                placeholder="rzp_test_... or rzp_live_..."
                value={form.razorpayKeyId}
                onChange={(e) => setForm((f) => ({ ...f, razorpayKeyId: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="set-rzp-sec">
                Razorpay Key Secret {form.hasRazorpaySecret ? "(Saved — enter to replace)" : ""}
              </label>
              <input
                id="set-rzp-sec"
                type="password"
                className="form-input"
                placeholder={form.hasRazorpaySecret ? "••••••••••••••••" : "Enter Key Secret"}
                value={form.razorpayKeySecret}
                onChange={(e) => setForm((f) => ({ ...f, razorpayKeySecret: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {savedMsg && (
          <div className={styles.successBanner} role="status">
            <CheckCircle size={16} /> {savedMsg}
          </div>
        )}
        {errorMsg && (
          <div className={styles.errorBanner} role="alert">
            {errorMsg}
          </div>
        )}

        <div className={styles.actions}>
          <button type="submit" disabled={saving} className="btn btn--primary btn--lg">
            <Save size={18} /> {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
