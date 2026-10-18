"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Star, Archive, Check, X, FolderPlus } from "lucide-react";
import styles from "./menu-manager.module.css";

export interface VariantRow {
  id: string;
  name: string;
  pricePaise: number;
  isDefault: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface MenuItemRow {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  pricePaise: number;
  isVegetarian: boolean;
  isSpicy: boolean;
  spicyLevel: number;
  status: "available" | "unavailable" | "archived";
  isFeatured: boolean;
  prepTimeMinutes: number | null;
  variants: VariantRow[];
}

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function MenuManagerClient({
  initialCategories,
  initialItems,
}: {
  initialCategories: CategoryRow[];
  initialItems: MenuItemRow[];
}) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [items, setItems] = useState<MenuItemRow[]>(initialItems);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    categoryId: initialCategories[0]?.id ?? "",
    name: "",
    description: "",
    priceRupees: "",
    isVegetarian: false,
    isSpicy: false,
    spicyLevel: 1,
    isFeatured: false,
    prepTimeMinutes: "20",
    hasVariants: false,
    halfRupees: "",
    fullRupees: "",
  });
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemSaving, setItemSaving] = useState(false);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCat !== "all" && item.categoryId !== selectedCat) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [items, selectedCat, search]);

  async function patchItem(
    itemId: string,
    payload: Partial<Pick<MenuItemRow, "status" | "isFeatured" | "pricePaise" | "name">>
  ) {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/dashboard/menu/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated.status === "archived") {
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        } else {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updated } : i)));
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/dashboard/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName.trim(),
          description: catDesc.trim() || undefined,
          sortOrder: categories.length + 1,
        }),
      });
      if (res.ok) {
        const created: CategoryRow = await res.json();
        setCategories((prev) => [...prev, created]);
        setItemForm((f) => ({ ...f, categoryId: f.categoryId || created.id }));
        setCatName("");
        setCatDesc("");
        setShowCatModal(false);
      }
    } finally {
      setCatSaving(false);
    }
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setItemError(null);

    const pricePaise = Math.round(Number(itemForm.priceRupees) * 100);
    if (!itemForm.categoryId) {
      setItemError("Please create and select a category first.");
      return;
    }
    if (!Number.isFinite(pricePaise) || pricePaise < 100) {
      setItemError("Enter a valid base price in ₹.");
      return;
    }

    const variants: { name: string; pricePaise: number; isDefault: boolean }[] = [];
    if (itemForm.hasVariants) {
      const half = Math.round(Number(itemForm.halfRupees) * 100);
      const full = Math.round(Number(itemForm.fullRupees) * 100);
      if (!Number.isFinite(half) || half < 100 || !Number.isFinite(full) || full < 100) {
        setItemError("Enter valid Half and Full prices in ₹.");
        return;
      }
      variants.push(
        { name: "Half", pricePaise: half, isDefault: true },
        { name: "Full", pricePaise: full, isDefault: false }
      );
    }

    setItemSaving(true);
    try {
      const res = await fetch("/api/dashboard/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: itemForm.categoryId,
          name: itemForm.name.trim(),
          description: itemForm.description.trim() || undefined,
          pricePaise: variants[0]?.pricePaise ?? pricePaise,
          isVegetarian: itemForm.isVegetarian,
          isSpicy: itemForm.isSpicy,
          spicyLevel: itemForm.isSpicy ? itemForm.spicyLevel : 0,
          isFeatured: itemForm.isFeatured,
          prepTimeMinutes: Number(itemForm.prepTimeMinutes) || undefined,
          variants,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemError(data.error ?? "Failed to create dish");
        return;
      }
      setItems((prev) => [data, ...prev]);
      setItemForm((f) => ({
        ...f,
        name: "",
        description: "",
        priceRupees: "",
        halfRupees: "",
        fullRupees: "",
        hasVariants: false,
        isFeatured: false,
      }));
      setShowItemModal(false);
    } finally {
      setItemSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Menu Manager</h1>
          <p className={styles.subtitle}>
            {items.filter((i) => i.status === "available").length} available ·{" "}
            {items.filter((i) => i.status === "unavailable").length} out of stock ·{" "}
            {categories.length} categories
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => setShowCatModal(true)}
            className="btn btn--secondary btn--sm"
          >
            <FolderPlus size={16} /> New Category
          </button>
          <button
            type="button"
            onClick={() => {
              if (!itemForm.categoryId && categories[0]) {
                setItemForm((f) => ({ ...f, categoryId: categories[0].id }));
              }
              setShowItemModal(true);
            }}
            className="btn btn--primary btn--sm"
          >
            <Plus size={16} /> Add Dish
          </button>
        </div>
      </div>

      {/* Category Filter + Search */}
      <div className={styles.toolbar}>
        <div className={styles.catTabs} role="tablist" aria-label="Filter by category">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCat === "all"}
            className={`${styles.catTab} ${selectedCat === "all" ? styles.catTabActive : ""}`}
            onClick={() => setSelectedCat("all")}
          >
            All ({items.length})
          </button>
          {categories.map((c) => {
            const cnt = items.filter((i) => i.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selectedCat === c.id}
                className={`${styles.catTab} ${selectedCat === c.id ? styles.catTabActive : ""}`}
                onClick={() => setSelectedCat(c.id)}
              >
                {c.name} ({cnt})
              </button>
            );
          })}
        </div>

        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes…"
            className={`form-input ${styles.searchInput}`}
            aria-label="Search dishes"
          />
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No dishes found</p>
          <p className={styles.emptySub}>
            {categories.length === 0
              ? "Start by creating your first menu category, or run npm run db:seed."
              : "Add a new dish or clear your search filter."}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const isAvailable = item.status === "available";
            const busy = busyId === item.id;
            return (
              <div
                key={item.id}
                className={`${styles.card} ${!isAvailable ? styles.cardUnavailable : ""}`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardMeta}>
                    <span
                      className={`veg-dot veg-dot--${item.isVegetarian ? "veg" : "nonveg"}`}
                      title={item.isVegetarian ? "Vegetarian" : "Non-Vegetarian"}
                    />
                    <span className={styles.catBadge}>
                      {categoryNameMap.get(item.categoryId) ?? "Uncategorised"}
                    </span>
                    {item.isFeatured && (
                      <span className={styles.featuredTag}>
                        <Star size={11} fill="currentColor" /> Chef&apos;s Pick
                      </span>
                    )}
                  </div>
                  <span className={styles.price}>{formatRupees(item.pricePaise)}</span>
                </div>

                <h3 className={styles.itemName}>{item.name}</h3>
                {item.description && <p className={styles.itemDesc}>{item.description}</p>}

                {item.variants.length > 0 && (
                  <div className={styles.variantRow}>
                    {item.variants.map((v) => (
                      <span key={v.id} className={styles.variantPill}>
                        {v.name}: {formatRupees(v.pricePaise)}
                      </span>
                    ))}
                  </div>
                )}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      patchItem(item.id, {
                        status: isAvailable ? "unavailable" : "available",
                      })
                    }
                    className={`${styles.toggleBtn} ${
                      isAvailable ? styles.toggleAvailable : styles.toggleUnavailable
                    }`}
                  >
                    {isAvailable ? <Check size={14} /> : <X size={14} />}
                    {isAvailable ? "In Stock" : "Out of Stock"}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchItem(item.id, { isFeatured: !item.isFeatured })}
                    className={styles.iconBtn}
                    title={item.isFeatured ? "Remove from Chef's Picks" : "Mark as Chef's Pick"}
                    aria-label="Toggle Chef's Pick"
                  >
                    <Star size={15} fill={item.isFeatured ? "currentColor" : "none"} />
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchItem(item.id, { status: "archived" })}
                    className={`${styles.iconBtn} ${styles.archiveBtn}`}
                    title="Archive dish"
                    aria-label={`Archive ${item.name}`}
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Category Modal */}
      {showCatModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="New Category">
          <form onSubmit={handleCreateCategory} className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>New Category</h2>
              <button type="button" onClick={() => setShowCatModal(false)} className={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <label className="form-label" htmlFor="cat-name">Category Name *</label>
            <input
              id="cat-name"
              className="form-input"
              required
              minLength={2}
              placeholder="e.g. Royal Biryanis"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <label className="form-label" htmlFor="cat-desc">Description</label>
            <input
              id="cat-desc"
              className="form-input"
              placeholder="Slow-cooked aromatic basmati biryanis"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
            />
            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setShowCatModal(false)} className="btn btn--secondary btn--sm">
                Cancel
              </button>
              <button type="submit" disabled={catSaving} className="btn btn--primary btn--sm">
                {catSaving ? "Saving…" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Dish Modal */}
      {showItemModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Add Dish">
          <form onSubmit={handleCreateItem} className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Add New Dish</h2>
              <button type="button" onClick={() => setShowItemModal(false)} className={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <label className="form-label" htmlFor="item-cat">Category *</label>
            <select
              id="item-cat"
              className="form-input"
              required
              value={itemForm.categoryId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label className="form-label" htmlFor="item-name">Dish Name *</label>
            <input
              id="item-name"
              className="form-input"
              required
              minLength={2}
              placeholder="e.g. Mutton Dum Biryani"
              value={itemForm.name}
              onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
            />

            <label className="form-label" htmlFor="item-desc">Description</label>
            <textarea
              id="item-desc"
              className="form-input"
              rows={2}
              placeholder="Tender marinated mutton layered with saffron basmati rice"
              value={itemForm.description}
              onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
            />

            <div className={styles.formRow}>
              <div>
                <label className="form-label" htmlFor="item-price">Base Price (₹) *</label>
                <input
                  id="item-price"
                  type="number"
                  min={1}
                  required
                  className="form-input"
                  placeholder="320"
                  value={itemForm.priceRupees}
                  onChange={(e) => setItemForm((f) => ({ ...f, priceRupees: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="item-prep">Prep Time (mins)</label>
                <input
                  id="item-prep"
                  type="number"
                  min={1}
                  max={180}
                  className="form-input"
                  value={itemForm.prepTimeMinutes}
                  onChange={(e) => setItemForm((f) => ({ ...f, prepTimeMinutes: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={itemForm.isVegetarian}
                  onChange={(e) => setItemForm((f) => ({ ...f, isVegetarian: e.target.checked }))}
                />
                Vegetarian
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={itemForm.isFeatured}
                  onChange={(e) => setItemForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                />
                Chef&apos;s Pick
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={itemForm.hasVariants}
                  onChange={(e) => setItemForm((f) => ({ ...f, hasVariants: e.target.checked }))}
                />
                Has Half / Full sizes
              </label>
            </div>

            {itemForm.hasVariants && (
              <div className={styles.formRow}>
                <div>
                  <label className="form-label" htmlFor="item-half">Half Price (₹) *</label>
                  <input
                    id="item-half"
                    type="number"
                    min={1}
                    required
                    className="form-input"
                    placeholder="220"
                    value={itemForm.halfRupees}
                    onChange={(e) => setItemForm((f) => ({ ...f, halfRupees: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="item-full">Full Price (₹) *</label>
                  <input
                    id="item-full"
                    type="number"
                    min={1}
                    required
                    className="form-input"
                    placeholder="380"
                    value={itemForm.fullRupees}
                    onChange={(e) => setItemForm((f) => ({ ...f, fullRupees: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {itemError && <p className={styles.errorText} role="alert">{itemError}</p>}

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setShowItemModal(false)} className="btn btn--secondary btn--sm">
                Cancel
              </button>
              <button type="submit" disabled={itemSaving} className="btn btn--primary btn--sm">
                {itemSaving ? "Adding…" : "Add Dish"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
