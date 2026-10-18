"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X, Phone, Clock, MapPin } from "lucide-react";
import { restaurantConfig } from "@/config/restaurant.config";
import { useCart } from "@/lib/cart";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { count: cartCount } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  // Menu auto-closes on navigation: it is "open" only for the path it was opened on.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath === pathname;
  const setMobileOpen = (v: boolean) => setOpenPath(v ? pathname : null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/menu", label: "Menu" },
    { href: "/about", label: "Our Story" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Top Info Bar */}
      <div className={styles.topBar}>
        <div className={`container ${styles.topBarInner}`}>
          <a href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`} className={styles.topBarItem}>
            <Phone size={13} />
            <span>{restaurantConfig.phone}</span>
          </a>
          <span className={styles.topBarDivider}>|</span>
          <span className={styles.topBarItem}>
            <Clock size={13} />
            <span>Mon–Fri: {restaurantConfig.hours.weekdays}</span>
          </span>
          <span className={styles.topBarDivider}>|</span>
          <a
            href={restaurantConfig.address.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.topBarItem}
          >
            <MapPin size={13} />
            <span>{restaurantConfig.address.city}</span>
          </a>
        </div>
      </div>

      {/* Main Navbar */}
      <header
        className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
        role="banner"
      >
        <div className={`container ${styles.navInner}`}>
          {/* Logo */}
          <Link href="/" className={styles.logo} aria-label={`${restaurantConfig.name} — Home`}>
            <div className={styles.logoMark}>
              <span className={styles.logoMono}>م</span>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoName}>{restaurantConfig.name}</span>
              <span className={styles.logoTagline}>{restaurantConfig.cuisine}</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className={styles.desktopNav} aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className={styles.navActions}>
            <Link href="/menu" className="btn btn--primary btn--sm">
              Order Now
            </Link>
            <Link
              href="/checkout"
              className={styles.cartBtn}
              aria-label={`Cart — ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className={styles.cartBadge} aria-live="polite">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Toggle */}
            <button
              className={styles.mobileToggle}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ""}`}
        aria-hidden={!mobileOpen}
        role="dialog"
        aria-label="Mobile navigation"
      >
        <div className={styles.mobileMenuHeader}>
          <span className={styles.mobileMenuTitle}>{restaurantConfig.name}</span>
          <button
            onClick={() => setMobileOpen(false)}
            className={styles.mobileClose}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className={styles.mobileNav}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.mobileNavLink} ${isActive(link.href) ? styles.mobileNavLinkActive : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.mobileCtas}>
          <Link href="/menu" className="btn btn--primary btn--full">
            Order Now
          </Link>
          <Link href="/checkout" className="btn btn--secondary btn--full">
            <ShoppingCart size={18} />
            View Cart {cartCount > 0 && `(${cartCount})`}
          </Link>
        </div>

        <div className={styles.mobileContact}>
          <a href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`} className={styles.mobileContactItem}>
            <Phone size={16} />
            {restaurantConfig.phone}
          </a>
          <span className={styles.mobileContactItem}>
            <Clock size={16} />
            {restaurantConfig.hours.weekdays}
          </span>
        </div>
      </div>
    </>
  );
}
