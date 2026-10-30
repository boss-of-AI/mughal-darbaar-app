"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Utensils, ShoppingBag, Receipt, Compass } from "lucide-react";
import { useCart } from "@/lib/cart";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: Utensils },
  { href: "/checkout", label: "Cart", icon: ShoppingBag },
  { href: "/profile", label: "Orders & Profile", icon: Receipt },
  { href: "/about", label: "Our Story", icon: Compass },
] as const;

/**
 * Floating glass pill navigation shown on mobile only (≤ 768px),
 * matching the royal-dark app-style design.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className={styles.nav} aria-label="Quick navigation">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          aria-current={isActive(href) ? "page" : undefined}
          className={`${styles.item} ${isActive(href) ? styles.itemActive : ""}`}
        >
          <Icon size={19} />
          {href === "/checkout" && count > 0 && (
            <span className={styles.badge}>{count > 9 ? "9+" : count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
