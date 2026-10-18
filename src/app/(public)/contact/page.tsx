import type { Metadata } from "next";
import { Instagram, Facebook } from "@/components/ui/SocialIcons";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import ContactForm from "./ContactForm";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${restaurantConfig.name}. Call, email, or visit us at Mohammad Ali Road, Mumbai.`,
};

export default function ContactPage() {
  return (
    <>
      <div className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>Get In Touch</h1>
          <p className={styles.subtitle}>We&apos;d love to hear from you — reservations, feedback, or just to say hello.</p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className={styles.grid}>
            {/* Contact Info */}
            <div className={styles.infoCol}>
              <h2 className={styles.infoTitle}>Contact Information</h2>
              <p className={styles.infoDesc}>Reach us through any of the following. We typically respond within 2 hours during business hours.</p>

              <div className={styles.infoList}>
                <a href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`} className={styles.infoItem}>
                  <div className={styles.infoIcon}><Phone size={20} /></div>
                  <div>
                    <div className={styles.infoLabel}>Phone / WhatsApp</div>
                    <div className={styles.infoValue}>{restaurantConfig.phone}</div>
                  </div>
                </a>
                <a href={`mailto:${restaurantConfig.email}`} className={styles.infoItem}>
                  <div className={styles.infoIcon}><Mail size={20} /></div>
                  <div>
                    <div className={styles.infoLabel}>Email</div>
                    <div className={styles.infoValue}>{restaurantConfig.email}</div>
                  </div>
                </a>
                <a href={restaurantConfig.address.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.infoItem}>
                  <div className={styles.infoIcon}><MapPin size={20} /></div>
                  <div>
                    <div className={styles.infoLabel}>Address</div>
                    <div className={styles.infoValue}>
                      {restaurantConfig.address.line1},<br />
                      {restaurantConfig.address.line2 && <>{restaurantConfig.address.line2},<br /></>}
                      {restaurantConfig.address.city} – {restaurantConfig.address.pincode}
                    </div>
                  </div>
                </a>
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Clock size={20} /></div>
                  <div>
                    <div className={styles.infoLabel}>Hours</div>
                    <div className={styles.infoValue}>
                      Mon–Fri: {restaurantConfig.hours.weekdays}<br />
                      Sat–Sun: {restaurantConfig.hours.weekends}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.socials}>
                <p className={styles.socialsLabel}>Follow Us</p>
                <div className={styles.socialsRow}>
                  {restaurantConfig.social.instagram && (
                    <a href={restaurantConfig.social.instagram} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Instagram">
                      <Instagram size={18} />
                    </a>
                  )}
                  {restaurantConfig.social.facebook && (
                    <a href={restaurantConfig.social.facebook} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Facebook">
                      <Facebook size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className={styles.formCol}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Send Us a Message</h2>
                <ContactForm email={restaurantConfig.email} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
