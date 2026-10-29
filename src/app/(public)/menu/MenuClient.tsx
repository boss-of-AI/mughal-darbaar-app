"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ShoppingCart, Plus, Minus, Leaf, Flame, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart, cartKey } from "@/lib/cart";
import { getSuggestedDishImage } from "@/lib/dish-images";
import styles from "./menu.module.css";

// ── Types ─────────────────────────────────────────────────────
interface Variant {
  id: string;
  name: string;
  pricePaise: number;
  isDefault: boolean;
}

interface MenuItem {
  variants: Variant[];
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pricePaise: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isSpicy: boolean;
  spicyLevel: number | null;
  isFeatured: boolean;
  imageUrl: string | null;
  calories: number | null;
  prepTimeMinutes: number | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  items: MenuItem[];
}

interface MenuClientProps {
  categories: Category[];
  gstPercent: string;
  deliveryFee: number;
  freeDeliveryAbove: number;
  minimumOrder: number;
}

// ── Helpers ───────────────────────────────────────────────────
const paise2rupee = (paise: number) => (paise / 100).toFixed(0);
const formatPrice = (paise: number) => `₹${paise2rupee(paise)}`;

// ── Main Component ────────────────────────────────────────────
export default function MenuClient({
  categories,
  gstPercent,
  deliveryFee,
  freeDeliveryAbove,
  minimumOrder,
}: MenuClientProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const router = useRouter();
  const {
    lines,
    count: cartCount,
    subtotalPaise: subtotal,
    tableToken,
    setTableToken,
    add,
    remove,
  } = useCart();
  const [sel, setSel] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [tables, setTables] = useState<
    { id: string; name: string; capacity: number; qrToken: string }[]
  >([]);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    fetch("/api/tables", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.tables)) setTables(d.tables);
      })
      .catch(() => {});
  }, []);

  const activeTableName =
    tables.find((t) => t.qrToken === tableToken)?.name ?? (tableToken ? "Dine-In Table" : null);

  const actualDeliveryFee = subtotal >= freeDeliveryAbove ? 0 : deliveryFee;
  const gstRate = parseFloat(gstPercent) / 100;
  const gstAmount = Math.round((subtotal + actualDeliveryFee) * gstRate);
  const total = subtotal + actualDeliveryFee + gstAmount;

  // Filtered categories/items
  const filtered = useMemo(() => {
    if (!search && !vegOnly) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          const matchesSearch =
            !search ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase());
          const matchesVeg = !vegOnly || item.isVegetarian;
          return matchesSearch && matchesVeg;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search, vegOnly]);

  // Cart helpers (variant-aware)
  const selectedVariant = (item: MenuItem) =>
    item.variants.find((v) => v.id === sel[item.id]) ??
    item.variants.find((v) => v.isDefault) ??
    item.variants[0] ??
    null;
  const unitPrice = (item: MenuItem) => selectedVariant(item)?.pricePaise ?? item.pricePaise;
  const addToCart = (item: MenuItem) => {
    const v = selectedVariant(item);
    add({
      itemId: item.id,
      name: item.name,
      isVegetarian: item.isVegetarian,
      variantId: v?.id ?? null,
      variantName: v?.name ?? null,
      unitPricePaise: unitPrice(item),
    });
  };
  const removeFromCart = (item: MenuItem) =>
    remove(cartKey(item.id, selectedVariant(item)?.id ?? null));

  // Scroll spy — highlight category in sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute("data-cat-id") ?? "");
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(categoryRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    categoryRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.page}>
      {/* ── Page Header ──────────────────────────────────── */}
      <div className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div>
              <h1 className={styles.title}>Our Menu</h1>
              <p className={styles.subtitle}>
                {categories.reduce((sum, c) => sum + c.items.length, 0)} authentic Mughal dishes
              </p>
            </div>

            {/* Dine-In vs Order Online Toggle */}
            <div
              role="group"
              aria-label="Order Mode Toggle"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "var(--color-surface)",
                border: "1.5px solid var(--color-border)",
                borderRadius: 999,
                padding: "4px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setTableToken(null)}
                style={{
                  padding: "0.45rem 0.95rem",
                  borderRadius: 999,
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: !tableToken ? "var(--color-primary)" : "transparent",
                  color: !tableToken ? "#fff" : "var(--color-text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                🛵 Order Online
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!tableToken) {
                    setTableToken(tables[0]?.qrToken || "dine-in-table-1-token");
                  }
                }}
                style={{
                  padding: "0.45rem 0.95rem",
                  borderRadius: 999,
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: tableToken ? "var(--color-primary)" : "transparent",
                  color: tableToken ? "#fff" : "var(--color-text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                🪑 Dine-In {activeTableName ? `(${activeTableName})` : ""}
              </button>
              {tableToken && tables.length > 0 && (
                <select
                  aria-label="Select Dine-In Table"
                  value={tableToken}
                  onChange={(e) => setTableToken(e.target.value)}
                  style={{
                    padding: "0.35rem 0.65rem",
                    borderRadius: 999,
                    border: "1px solid var(--color-border)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    background: "#FFFBEB",
                    color: "#92400E",
                    cursor: "pointer",
                  }}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.qrToken}>
                      🪑 {t.name} ({t.capacity} seats)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={styles.filters}>
              {/* Search */}
              <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  id="menu-search"
                  type="search"
                  placeholder="Search dishes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                  aria-label="Search menu items"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className={styles.searchClear}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Veg filter */}
              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`${styles.vegFilter} ${vegOnly ? styles.vegFilterActive : ""}`}
                aria-pressed={vegOnly}
              >
                <Leaf size={15} />
                Veg Only
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className={styles.layout}>
          {/* ── Category Sidebar ─────────────────────────── */}
          <aside className={styles.sidebar} aria-label="Menu categories">
            <nav className={styles.catNav}>
              {filtered.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catBtnActive : ""}`}
                  aria-current={activeCategory === cat.id ? "true" : undefined}
                >
                  <span className={styles.catBtnName}>{cat.name}</span>
                  <span className={styles.catBtnCount}>{cat.items.length}</span>
                </button>
              ))}
            </nav>

            {/* Mini cart summary in sidebar */}
            {cartCount > 0 && (
              <div className={styles.sidebarCart}>
                <div className={styles.sidebarCartInfo}>
                  <ShoppingCart size={16} />
                  <span>{cartCount} items</span>
                </div>
                <span className={styles.sidebarCartTotal}>{formatPrice(subtotal)}</span>
                <button
                  onClick={() => setCartOpen(true)}
                  className="btn btn--primary btn--sm btn--full"
                >
                  View Cart
                </button>
              </div>
            )}
          </aside>

          {/* ── Menu Sections ─────────────────────────────── */}
          <main className={styles.menuMain}>
            {filtered.length === 0 ? (
              <div className={styles.noResults}>
                <span className={styles.noResultsEmoji}>🔍</span>
                <h3>No dishes found</h3>
                <p>Try a different search term or remove filters.</p>
                <button
                  onClick={() => { setSearch(""); setVegOnly(false); }}
                  className="btn btn--secondary"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filtered.map((cat) => (
                <section
                  key={cat.id}
                  id={`cat-${cat.id}`}
                  data-cat-id={cat.id}
                  ref={(el) => { categoryRefs.current[cat.id] = el; }}
                  className={styles.catSection}
                  aria-labelledby={`cat-heading-${cat.id}`}
                >
                  <div className={styles.catHeader}>
                    <h2 id={`cat-heading-${cat.id}`} className={styles.catTitle}>
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className={styles.catDesc}>{cat.description}</p>
                    )}
                  </div>

                  <div className={styles.itemGrid}>
                    {cat.items.map((item) => {
                      const qty = lines.find((l) => l.key === cartKey(item.id, selectedVariant(item)?.id ?? null))?.quantity ?? 0;
                      return (
                        <article
                          key={item.id}
                          className={`${styles.itemCard} ${item.isFeatured ? styles.itemCardFeatured : ""}`}
                        >
                          {/* Dish Photo (with suggested Mughlai photo fallback) */}
                          <div className={styles.itemImageWrap}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl || getSuggestedDishImage(item.name, cat.slug)}
                              alt={item.name}
                              loading="lazy"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                            {item.isFeatured && (
                              <span className={styles.featuredBadge}>
                                <Star size={10} fill="currentColor" /> Chef&apos;s Pick
                              </span>
                            )}
                          </div>

                          <div className={styles.itemBody}>
                            {/* Veg/non-veg + spicy */}
                            <div className={styles.itemMeta}>
                              <div
                                className={`veg-dot veg-dot--${item.isVegetarian ? "veg" : "nonveg"}`}
                                title={item.isVegetarian ? "Vegetarian" : "Non-Vegetarian"}
                              />
                              {item.isSpicy && item.spicyLevel && item.spicyLevel > 0 && (
                                <span className={styles.spicyIndicator} title={`Spicy level ${item.spicyLevel}/3`}>
                                  {Array.from({ length: item.spicyLevel }).map((_, i) => (
                                    <Flame key={i} size={11} fill="currentColor" />
                                  ))}
                                </span>
                              )}
                              {item.calories && (
                                <span className={styles.calories}>{item.calories} kcal</span>
                              )}
                            </div>

                            <h3 className={styles.itemName}>{item.name}</h3>
                            {item.description && (
                              <p className={styles.itemDesc}>{item.description}</p>
                            )}

                            {item.prepTimeMinutes && (
                              <p className={styles.itemTime}>⏱ {item.prepTimeMinutes} min</p>
                            )}

                            {item.variants.length > 0 && (
                              <div role="radiogroup" aria-label={`${item.name} size`} style={{ display: "flex", gap: "0.4rem", margin: "0.5rem 0" }}>
                                {item.variants.map((v) => {
                                  const active = selectedVariant(item)?.id === v.id;
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      role="radio"
                                      aria-checked={active}
                                      onClick={() => setSel((p) => ({ ...p, [item.id]: v.id }))}
                                      style={{
                                        padding: "0.25rem 0.7rem",
                                        borderRadius: "999px",
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                        border: "1px solid var(--color-primary)",
                                        background: active ? "var(--color-primary)" : "transparent",
                                        color: active ? "#fff" : "var(--color-primary)",
                                      }}
                                    >
                                      {v.name} · {formatPrice(v.pricePaise)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className={styles.itemFooter}>
                              <span className="price price--primary" style={{ fontSize: "var(--text-xl)" }}>
                                {formatPrice(unitPrice(item))}
                              </span>

                              {/* Add/Remove controls */}
                              {qty === 0 ? (
                                <button
                                  onClick={() => addToCart(item)}
                                  className="btn btn--primary btn--sm"
                                  aria-label={`Add ${item.name} to cart`}
                                >
                                  <Plus size={16} /> Add
                                </button>
                              ) : (
                                <div className={styles.qtyControl} role="group" aria-label={`${item.name} quantity`}>
                                  <button
                                    onClick={() => removeFromCart(item)}
                                    className={styles.qtyBtn}
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className={styles.qtyValue} aria-live="polite">{qty}</span>
                                  <button
                                    onClick={() => addToCart(item)}
                                    className={`${styles.qtyBtn} ${styles.qtyBtnAdd}`}
                                    aria-label="Increase quantity"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </main>
        </div>
      </div>

      {/* ── Floating Cart Button (mobile) ─────────────────── */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className={styles.floatingCart}
          aria-label={`View cart — ${cartCount} items`}
        >
          <ShoppingCart size={20} />
          <span>{cartCount} items</span>
          <span className={styles.floatingCartPrice}>{formatPrice(subtotal)}</span>
        </button>
      )}

      {/* ── Cart Drawer ───────────────────────────────────── */}
      {cartOpen && (
        <div className={styles.drawerOverlay} onClick={() => setCartOpen(false)} aria-hidden="true" />
      )}
      <div
        className={`${styles.cartDrawer} ${cartOpen ? styles.cartDrawerOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>
            <ShoppingCart size={20} /> Your Order
          </h2>
          <button onClick={() => setCartOpen(false)} className={styles.drawerClose} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {cartCount === 0 ? (
          <div className={styles.emptyCart}>
            <span className={styles.emptyCartEmoji}>🛒</span>
            <p>Your cart is empty</p>
            <button onClick={() => setCartOpen(false)} className="btn btn--secondary">
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div className={styles.drawerItems}>
              {lines.map((l) => (
                <div key={l.key} className={styles.cartItem}>
                  <div className={styles.cartItemInfo}>
                    <div className={`veg-dot veg-dot--${l.isVegetarian ? "veg" : "nonveg"}`} />
                    <span className={styles.cartItemName}>
                      {l.name}
                      {l.variantName ? ` (${l.variantName})` : ""}
                    </span>
                  </div>
                  <div className={styles.cartItemRight}>
                    <div className={styles.qtyControl}>
                      <button onClick={() => remove(l.key)} className={styles.qtyBtn} aria-label="Decrease quantity">
                        <Minus size={12} />
                      </button>
                      <span className={styles.qtyValue}>{l.quantity}</span>
                      <button
                        onClick={() => add({ itemId: l.itemId, name: l.name, isVegetarian: l.isVegetarian, variantId: l.variantId, variantName: l.variantName, unitPricePaise: l.unitPricePaise })}
                        className={`${styles.qtyBtn} ${styles.qtyBtnAdd}`}
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className={styles.cartItemPrice}>{formatPrice(l.unitPricePaise * l.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className={styles.drawerSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Delivery Fee</span>
                <span>
                  {actualDeliveryFee === 0 ? (
                    <span className={styles.freeText}>FREE</span>
                  ) : (
                    formatPrice(actualDeliveryFee)
                  )}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span>GST ({gstPercent}%)</span>
                <span>{formatPrice(gstAmount)}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total</span>
                <span className={styles.totalPrice}>{formatPrice(total)}</span>
              </div>

              {subtotal < minimumOrder && (
                <p className={styles.minOrderNote}>
                  Minimum order for delivery is {formatPrice(minimumOrder)} (add{" "}
                  {formatPrice(minimumOrder - subtotal)} more, or choose Pickup at checkout).
                </p>
              )}

              {subtotal < freeDeliveryAbove && actualDeliveryFee > 0 && (
                <p className={styles.freeDeliveryNote}>
                  Add {formatPrice(freeDeliveryAbove - subtotal)} more for free delivery!
                </p>
              )}
            </div>

            <div className={styles.drawerActions}>
              <button
                type="button"
                className="btn btn--primary btn--full btn--lg"
                onClick={() => router.push("/checkout")}
              >
                Proceed to Checkout →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
