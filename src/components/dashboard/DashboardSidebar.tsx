"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed,
  Settings, Users, QrCode, BarChart3, LogOut, ChevronRight, Tag, Navigation
} from "lucide-react";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./DashboardSidebar.module.css";

const navItems = [
  { href: "/dashboard",          icon: LayoutDashboard,  label: "Overview",         exact: true },
  { href: "/dashboard/orders",   icon: ShoppingBag,      label: "Orders",           badge: "live" },
  { href: "/dashboard/rider",    icon: Navigation,       label: "Rider Portal",     badge: "live", riderAllowed: true },
  { href: "/dashboard/menu",     icon: UtensilsCrossed,  label: "Menu Manager" },
  { href: "/dashboard/offers",   icon: Tag,              label: "Offers & Coupons" },
  { href: "/dashboard/tables",   icon: QrCode,           label: "Tables & QR" },
  { href: "/dashboard/reports",  icon: BarChart3,        label: "Reports" },
  { href: "/dashboard/staff",    icon: Users,            label: "Staff & Riders" },
  { href: "/dashboard/settings", icon: Settings,         label: "Settings",         ownerOnly: true },
];

interface Props { userRole?: string; userName?: string; }

export default function DashboardSidebar({ userRole, userName }: Props) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const visibleItems = navItems.filter((item) => {
    if (userRole === "rider") return Boolean(item.riderAllowed);
    if (item.ownerOnly && userRole !== "owner") return false;
    return true;
  });

  const portalLabel =
    userRole === "owner" ? "Owner" : userRole === "rider" ? "Delivery Rider" : "Staff";

  return (
    <aside className={styles.sidebar} aria-label="Dashboard navigation">
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <span>م</span>
        </div>
        <div>
          <p className={styles.brandName}>{restaurantConfig.name}</p>
          <p className={styles.brandRole}>{portalLabel} Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav} aria-label="Dashboard menu">
        {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href, item.exact) ? styles.navItemActive : ""}`}
              aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            >
              <item.icon size={18} className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge === "live" && (
                <span className={styles.liveBadge} aria-label="Live updates">
                  <span className={styles.liveDot} />
                  LIVE
                </span>
              )}
              {isActive(item.href, item.exact) && <ChevronRight size={14} className={styles.activeChevron} />}
            </Link>
          ))}
      </nav>

      {/* User */}
      <div className={styles.userSection}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>
            {(userName || "U").charAt(0).toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{userName || "Staff"}</p>
            <p className={styles.userRole}>{userRole || "staff"}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className={styles.signOutBtn}
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
