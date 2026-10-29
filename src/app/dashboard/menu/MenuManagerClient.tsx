"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Star,
  Archive,
  Check,
  X,
  FolderPlus,
  Image as ImageIcon,
  Upload,
  Sparkles,
} from "lucide-react";
import { CURATED_DISH_PHOTOS, getSuggestedDishImage } from "@/lib/dish-images";
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
  imageUrl: string | null;
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

/** Resize & compress an uploaded image file to a clean Data URL (max 640px) */
function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        const maxDim = 640;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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
  const [autoFilling, setAutoFilling] = useState(false);

  // Create Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Create Dish Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    categoryId: initialCategories[0]?.id ?? "",
    name: "",
    description: "",
    imageUrl: "",
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

  // Edit Dish & Photo Modal
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    priceRupees: "",
    imageUrl: "",
    isVegetarian: false,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const categorySlugMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.slug])),
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
    payload: Partial<
      Pick<
        MenuItemRow,
        "status" | "isFeatured" | "pricePaise" | "name" | "description" | "imageUrl" | "isVegetarian"
      >
    >
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
        return true;
      }
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAutoFillPhotos() {
    setAutoFilling(true);
    try {
      for (const item of items) {
        if (!item.imageUrl) {
          const suggested = getSuggestedDishImage(
            item.name,
            categorySlugMap.get(item.categoryId)
          );
          await patchItem(item.id, { imageUrl: suggested });
        }
      }
    } finally {
      setAutoFilling(false);
    }
  }

  function openEditModal(item: MenuItemRow) {
    setEditingItem(item);
    setEditError(null);
    setEditForm({
      name: item.name,
      description: item.description ?? "",
      priceRupees: String(Math.round(item.pricePaise / 100)),
      imageUrl:
        item.imageUrl ||
        getSuggestedDishImage(item.name, categorySlugMap.get(item.categoryId)),
      isVegetarian: item.isVegetarian,
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);

    const pricePaise = Math.round(Number(editForm.priceRupees) * 100);
    if (!Number.isFinite(pricePaise) || pricePaise < 100) {
      setEditError("Enter a valid price in ₹.");
      return;
    }

    setEditSaving(true);
    try {
      const ok = await patchItem(editingItem.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        pricePaise,
        imageUrl: editForm.imageUrl.trim() || null,
        isVegetarian: editForm.isVegetarian,
      });
      if (ok) {
        setEditingItem(null);
      } else {
        setEditError("Failed to update dish.");
      }
    } finally {
      setEditSaving(false);
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
          imageUrl:
            itemForm.imageUrl.trim() ||
            getSuggestedDishImage(
              itemForm.name.trim(),
              categorySlugMap.get(itemForm.categoryId)
            ),
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
        imageUrl: "",
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
          {items.some((i) => !i.imageUrl) && (
            <button
              type="button"
              disabled={autoFilling}
              onClick={handleAutoFillPhotos}
              className="btn btn--secondary btn--sm"
              title="Automatically assign nice Mughlai photos to dishes without a custom photo"
            >
              <Sparkles size={15} />{" "}
              {autoFilling ? "Applying Photos…" : "Auto-Fill Dish Photos"}
            </button>
          )}
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
            const displayImg =
              item.imageUrl ||
              getSuggestedDishImage(item.name, categorySlugMap.get(item.categoryId));

            return (
              <div
                key={item.id}
                className={`${styles.card} ${!isAvailable ? styles.cardUnavailable : ""}`}
              >
                {/* Dish Image Thumbnail + Edit Photo Overlay */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 145,
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: "0.75rem",
                    background: "var(--color-surface-alt)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImg}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: "rgba(17, 24, 39, 0.84)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.22)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <ImageIcon size={13} /> Edit Photo / Dish
                  </button>
                </div>

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
                    onClick={() => openEditModal(item)}
                    className={styles.iconBtn}
                    title="Edit Dish Photo, Name & Price"
                    aria-label={`Edit ${item.name}`}
                  >
                    <ImageIcon size={15} />
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

      {/* Edit Dish & Photo Modal */}
      {editingItem && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Edit Dish & Photo"
        >
          <form
            onSubmit={handleSaveEdit}
            className={styles.modal}
            style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className={styles.modalHeader}>
              <h2>Edit Dish &amp; Photo</h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Image Preview */}
            <div
              style={{
                width: "100%",
                height: 180,
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--color-surface-alt)",
                border: "1px solid var(--color-border)",
                marginBottom: "0.75rem",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  editForm.imageUrl ||
                  getSuggestedDishImage(
                    editForm.name || editingItem.name,
                    categorySlugMap.get(editingItem.categoryId)
                  )
                }
                alt={editForm.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            {/* Upload from Device OR Paste Image URL */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0.5rem 0.9rem",
                  borderRadius: 8,
                  background: "var(--color-primary)",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Upload size={14} /> Upload Photo from Device
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressImageFile(file);
                      setEditForm((f) => ({ ...f, imageUrl: dataUrl }));
                    } catch {
                      setEditError("Could not process image file.");
                    }
                  }}
                />
              </label>

              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() =>
                  setEditForm((f) => ({
                    ...f,
                    imageUrl: getSuggestedDishImage(
                      f.name || editingItem.name,
                      categorySlugMap.get(editingItem.categoryId)
                    ),
                  }))
                }
              >
                <Sparkles size={14} /> Auto-Suggest Photo
              </button>
            </div>

            <label className="form-label" htmlFor="edit-img-url">
              Image URL (or Pick from Royal Mughlai Gallery Below)
            </label>
            <input
              id="edit-img-url"
              className="form-input"
              placeholder="https://images.unsplash.com/..."
              value={editForm.imageUrl.startsWith("data:") ? "" : editForm.imageUrl}
              onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />

            {/* Quick-Pick Curated Gallery */}
            <div style={{ margin: "0.5rem 0 1rem" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  marginBottom: "0.4rem",
                }}
              >
                Tap a photo below to select:
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 6,
                }}
              >
                {CURATED_DISH_PHOTOS.map((p) => {
                  const selected = editForm.imageUrl === p.url;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, imageUrl: p.url }))}
                      title={p.label}
                      style={{
                        padding: 0,
                        border: selected
                          ? "2.5px solid var(--color-primary)"
                          : "1px solid var(--color-border)",
                        borderRadius: 8,
                        overflow: "hidden",
                        height: 52,
                        cursor: "pointer",
                        background: "none",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="form-label" htmlFor="edit-name">
              Dish Name *
            </label>
            <input
              id="edit-name"
              className="form-input"
              required
              minLength={2}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />

            <label className="form-label" htmlFor="edit-desc">
              Description
            </label>
            <textarea
              id="edit-desc"
              className="form-input"
              rows={2}
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />

            <div className={styles.formRow}>
              <div>
                <label className="form-label" htmlFor="edit-price">
                  Base Price (₹) *
                </label>
                <input
                  id="edit-price"
                  type="number"
                  min={1}
                  required
                  className="form-input"
                  value={editForm.priceRupees}
                  onChange={(e) => setEditForm((f) => ({ ...f, priceRupees: e.target.value }))}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingTop: "1.4rem" }}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editForm.isVegetarian}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, isVegetarian: e.target.checked }))
                    }
                  />
                  Vegetarian Dish
                </label>
              </div>
            </div>

            {editError && (
              <p className={styles.errorText} role="alert">
                {editError}
              </p>
            )}

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={editSaving} className="btn btn--primary btn--sm">
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
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
          <form
            onSubmit={handleCreateItem}
            className={styles.modal}
            style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
          >
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

            {/* Dish Photo Section */}
            <div style={{ margin: "0.5rem 0" }}>
              <label className="form-label">Dish Photo</label>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <div
                  style={{
                    width: 76,
                    height: 60,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      itemForm.imageUrl ||
                      getSuggestedDishImage(
                        itemForm.name || "biryani",
                        categorySlugMap.get(itemForm.categoryId)
                      )
                    }
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "0.4rem 0.75rem",
                      borderRadius: 8,
                      background: "var(--color-surface-alt)",
                      border: "1px solid var(--color-border)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      width: "fit-content",
                    }}
                  >
                    <Upload size={13} /> Upload Image File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageFile(file);
                          setItemForm((f) => ({ ...f, imageUrl: dataUrl }));
                        } catch {
                          setItemError("Could not process image file.");
                        }
                      }}
                    />
                  </label>
                  <input
                    className="form-input"
                    placeholder="Or paste image URL (auto-selected if left blank)"
                    value={itemForm.imageUrl.startsWith("data:") ? "" : itemForm.imageUrl}
                    onChange={(e) => setItemForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 5,
                }}
              >
                {CURATED_DISH_PHOTOS.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, imageUrl: p.url }))}
                    title={p.label}
                    style={{
                      padding: 0,
                      border:
                        itemForm.imageUrl === p.url
                          ? "2px solid var(--color-primary)"
                          : "1px solid var(--color-border)",
                      borderRadius: 6,
                      overflow: "hidden",
                      height: 42,
                      cursor: "pointer",
                      background: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.label}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            </div>

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
