import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Heart,
} from "lucide-react";
import { Instagram, Facebook } from "@/components/ui/SocialIcons";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo">
      {/* Top ornament */}
      <div className={styles.ornamentBar}>
        <span className={styles.ornamentText}>
          ✦ &nbsp; Crafted with tradition &nbsp; ✦
        </span>
      </div>

      <div className={`container ${styles.grid}`}>
        {/* Brand Column */}
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <span>م</span>
          </div>
          <h2 className={styles.brandName}>{restaurantConfig.name}</h2>
          <p className={styles.brandTagline}>{restaurantConfig.tagline}</p>
          <p className={styles.brandDesc}>
            {restaurantConfig.description.slice(0, 130)}…
          </p>
          <div className={styles.socials}>
            {restaurantConfig.social.instagram && (
              <a
                href={restaurantConfig.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={styles.socialLink}
              >
                <Instagram size={18} />
              </a>
            )}
            {restaurantConfig.social.facebook && (
              <a
                href={restaurantConfig.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className={styles.socialLink}
              >
                <Facebook size={18} />
              </a>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>Explore</h3>
          <ul className={styles.linkList}>
            {[
              { href: "/", label: "Home" },
              { href: "/menu", label: "Full Menu" },
              { href: "/about", label: "Our Story" },
              { href: "/contact", label: "Contact Us" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.footerLink}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Order & Policies */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>Order</h3>
          <ul className={styles.linkList}>
            <li>
              <Link href="/menu" className={styles.footerLink}>
                Order Online
              </Link>
            </li>
            <li>
              <Link href="/menu?mode=pickup" className={styles.footerLink}>
                Pickup
              </Link>
            </li>
            <li>
              <Link href="/delivery-policy" className={styles.footerLink}>
                Delivery Policy
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={styles.footerLink}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={styles.footerLink}>
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact & Hours */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>Find Us</h3>
          <ul className={styles.contactList}>
            <li className={styles.contactItem}>
              <MapPin size={15} className={styles.contactIcon} />
              <span>
                {restaurantConfig.address.line1},{" "}
                {restaurantConfig.address.city} –{" "}
                {restaurantConfig.address.pincode}
              </span>
            </li>
            <li className={styles.contactItem}>
              <Phone size={15} className={styles.contactIcon} />
              <a
                href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`}
                className={styles.footerLink}
              >
                {restaurantConfig.phone}
              </a>
            </li>
            <li className={styles.contactItem}>
              <Mail size={15} className={styles.contactIcon} />
              <a
                href={`mailto:${restaurantConfig.email}`}
                className={styles.footerLink}
              >
                {restaurantConfig.email}
              </a>
            </li>
            <li className={styles.contactItem}>
              <Clock size={15} className={styles.contactIcon} />
              <div>
                <div>Mon–Fri: {restaurantConfig.hours.weekdays}</div>
                <div>Sat–Sun: {restaurantConfig.hours.weekends}</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={`container ${styles.bottomInner}`}>
          <p className={styles.copyright}>
            © {year} {restaurantConfig.name}. All rights reserved.
          </p>
          <p className={styles.madeWith}>
            Made with <Heart size={12} className={styles.heartIcon} /> in
            Mumbai, India
          </p>
          <div className={styles.badges}>
            <span className={styles.badge}>🔒 Secure Checkout</span>
            <span className={styles.badge}>⚡ Razorpay</span>
            <span className={styles.badge}>🍃 FSSAI Certified</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
