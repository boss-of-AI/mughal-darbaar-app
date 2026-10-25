"use client";

import { useState } from "react";
import { Tag, Sparkles, Trash2, CheckCircle, XCircle } from "lucide-react";
import styles from "./offers.module.css";

export interface OfferRow {
  id: string;
  title: string;
  code: string;
  discountPct: number;
  categoryId: string | null;
  categoryName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export default function OffersClient({
  initialOffers,
  categories,
}: {
  initialOffers: OfferRow[];
  categories: CategoryOption[];
}) {
  const [offersList, setOffersList] = useState<OfferRow[]>(initialOffers);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [discountPct, setDiscountPct] = useState<string>("20");
  const [title, setTitle] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function autoGenerateCode(catId: string, pct: string) {
    const catName =
      catId === "all"
        ? "ROYAL"
        : (categories.find((c) => c.id === catId)?.name ?? "OFFER")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 7);
    const cleanPct = pct.replace(/[^0-9]/g, "") || "20";
    const generatedCode = `${catName}${cleanPct}`;
    setCode(generatedCode);
    if (!title.trim()) {
      const catLabel =
        catId === "all"
          ? "All Menu Items"
          : categories.find((c) => c.id === catId)?.name ?? "Selected Category";
      setTitle(`Flat ${cleanPct}% OFF on ${catLabel}`);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          code: code.trim().toUpperCase(),
          discountPct: Number(discountPct) || 10,
          categoryId: categoryId === "all" ? null : categoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create offer");
        return;
      }
      setOffersList((prev) => [data, ...prev]);
      setTitle("");
      setCode("");
      setSuccessMsg(
        `Offer "${data.code}" (${data.discountPct}% OFF on ${data.categoryName}) is now LIVE for customers!`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleOffer(offer: OfferRow) {
    setBusyId(offer.id);
    try {
      const res = await fetch(`/api/dashboard/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOffersList((prev) => prev.map((o) => (o.id === offer.id ? { ...o, isActive: updated.isActive } : o)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOffer(offerId: string) {
    setBusyId(offerId);
    try {
      const res = await fetch(`/api/dashboard/offers/${offerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOffersList((prev) => prev.filter((o) => o.id !== offerId));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Category Offers &amp; Coupon Generator</h1>
          <p className={styles.subtitle}>
            Generate category-wise discounts &amp; coupon codes. Active offers automatically pop up for customers when they open the website!
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Create Offer Form */}
        <form onSubmit={handleCreate} className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <Sparkles size={18} /> Create Category Offer / Coupon
          </h2>

          <label className="form-label" htmlFor="of-cat">Select Category *</label>
          <select
            id="of-cat"
            className="form-input"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
            }}
          >
            <option value="all">🌟 All Categories (Storewide Offer)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                🍛 {c.name}
              </option>
            ))}
          </select>

          <label className="form-label" htmlFor="of-pct">Discount Percentage (%) *</label>
          <input
            id="of-pct"
            type="number"
            min={1}
            max={90}
            required
            className="form-input"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="e.g. 20"
          />

          <div className={styles.codeRow}>
            <div style={{ flex: 1 }}>
              <label className="form-label" htmlFor="of-code">Coupon Code *</label>
              <input
                id="of-code"
                className="form-input"
                required
                minLength={3}
                maxLength={25}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. BIRYANI20"
              />
            </div>
            <button
              type="button"
              onClick={() => autoGenerateCode(categoryId, discountPct)}
              className={`btn btn--secondary btn--sm ${styles.genBtn}`}
            >
              ⚡ Auto-Generate
            </button>
          </div>

          <label className="form-label" htmlFor="of-title">Offer Headline (Shown in Customer Popup) *</label>
          <input
            id="of-title"
            className="form-input"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flat 20% OFF on All Royal Biryanis!"
          />

          {error && <p className={styles.errorText} role="alert">{error}</p>}
          {successMsg && <p className={styles.successText} role="status">{successMsg}</p>}

          <button type="submit" disabled={saving} className="btn btn--primary btn--full">
            <Tag size={16} /> {saving ? "Publishing Offer…" : "Publish Offer & Notify Customers"}
          </button>
        </form>

        {/* Active & Past Offers List */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            Active &amp; Saved Offers ({offersList.length})
          </h2>

          {offersList.length === 0 ? (
            <div className={styles.empty}>
              <p>No offers created yet. Use the generator on the left to launch a category discount!</p>
            </div>
          ) : (
            <div className={styles.list}>
              {offersList.map((o) => {
                const busy = busyId === o.id;
                return (
                  <div
                    key={o.id}
                    className={`${styles.offerItem} ${!o.isActive ? styles.offerInactive : ""}`}
                  >
                    <div className={styles.offerTop}>
                      <div>
                        <span className={styles.codePill}>{o.code}</span>
                        <span className={styles.pctBadge}>{o.discountPct}% OFF</span>
                        <span className={styles.catBadge}>{o.categoryName}</span>
                      </div>
                      <span className={o.isActive ? styles.livePill : styles.pausedPill}>
                        {o.isActive ? "● LIVE" : "PAUSED"}
                      </span>
                    </div>

                    <p className={styles.offerTitle}>{o.title}</p>

                    <div className={styles.offerActions}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleOffer(o)}
                        className={styles.actionBtn}
                      >
                        {o.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        {o.isActive ? "Pause Offer" : "Activate Offer"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteOffer(o.id)}
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
