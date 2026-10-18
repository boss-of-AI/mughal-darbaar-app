import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Award, Heart, Leaf, Users } from "lucide-react";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "Our Story",
  description: `Learn about ${restaurantConfig.name} — a 15-year legacy of authentic Mughal cuisine on Mohammad Ali Road, Mumbai.`,
};

const timeline = [
  { year: "2009", title: "The Beginning", desc: "Chef Arif Khan opens a 12-seat dhaba on Mohammad Ali Road, serving his grandmother's Nihari recipe to the neighbourhood." },
  { year: "2013", title: "The First Award", desc: "Mughal Darbaar wins 'Best Mughal Cuisine in Mumbai' at the Maharashtra Food Excellence Awards. Queues stretch around the block." },
  { year: "2016", title: "Expansion", desc: "We move to our current 80-seat restaurant. The VIP Room is added to host royal weddings and corporate feasts." },
  { year: "2019", title: "Online Ordering", desc: "We launch home delivery — because great Mughal food should reach every corner of Mumbai." },
  { year: "2024", title: "Today", desc: "500+ orders daily. Still the same grandmother's recipes. Still the same love." },
];

const values = [
  { icon: Heart, title: "Cooked with Love", desc: "Every dish is made to order. Nothing sits under a heat lamp. We cook as if feeding our own family." },
  { icon: Leaf, title: "Freshest Ingredients", desc: "Whole spices sourced daily from Crawford Market. Fresh curd from local dairies. No shortcuts, no compromise." },
  { icon: Award, title: "Tradition & Craft", desc: "Our recipes are 400-year-old Mughal court recipes, passed down through family and perfected with each generation." },
  { icon: Users, title: "Community First", desc: "We employ local Mumbai talent, source locally, and give back to the Mohammad Ali Road community that made us." },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.eyebrow}>✦ &nbsp; Est. 2009, Mumbai &nbsp; ✦</span>
          <h1 className={styles.title}>A Story Written<br />in Spice & Fire</h1>
          <p className={styles.subtitle}>
            From a 12-seat dhaba to one of Mumbai&apos;s most beloved Mughal restaurants — ours is a story of family, tradition, and an uncompromising obsession with flavour.
          </p>
        </div>
      </div>

      {/* Story Section */}
      <section className="section">
        <div className="container">
          <div className={styles.storyGrid}>
            <div className={styles.storyLeft}>
              <span className="section-title__eyebrow" style={{ textAlign: "left", display: "block" }}>The Founder</span>
              <h2 className={styles.storyTitle}>Chef Arif Khan&apos;s Royal Vision</h2>
              <div className="divider--gold" style={{ maxWidth: "100px", margin: "1.5rem 0" }} />
              <p className={styles.storyText}>
                Chef Arif grew up watching his grandmother cook in the old quarter of Lucknow. She learned from her mother, who had worked in the royal kitchens of the Nawabs of Awadh. The recipes were never written down — only passed through memory, smell, and taste.
              </p>
              <p className={styles.storyText}>
                When Chef Arif moved to Mumbai, he carried those recipes in his heart. In 2009, he opened Mughal Darbaar with ₹80,000 in savings, a borrowed tandoor, and a fierce belief that Mumbai deserved food worthy of a royal court.
              </p>
              <p className={styles.storyText}>
                Fifteen years later, nothing has changed about the recipes. Everything else has grown.
              </p>
              <Link href="/menu" className="btn btn--primary btn--lg" style={{ marginTop: "2rem", display: "inline-flex" }}>
                Taste the Legacy <ChevronRight size={18} />
              </Link>
            </div>

            <div className={styles.storyRight}>
              <div className={styles.chefCard}>
                <div className={styles.chefEmoji}>👨‍🍳</div>
                <div className={styles.chefInfo}>
                  <h3>Chef Arif Khan</h3>
                  <p>Founder & Head Chef</p>
                  <blockquote className={styles.chefQuote}>
                    &ldquo;A biryani is not a recipe. It is a relationship between the cook, the spice, and the fire. You cannot rush it. You cannot fake it.&rdquo;
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className={`section ${styles.timelineSection}`}>
        <div className="container">
          <div className="section-title">
            <span className="section-title__eyebrow">Our Journey</span>
            <h2 className="section-title__heading">15 Years of Legacy</h2>
            <div className="section-title__ornament"><span className="section-title__ornament-icon">✦</span></div>
          </div>

          <div className={styles.timeline}>
            {timeline.map((item, i) => (
              <div key={item.year} className={`${styles.timelineItem} ${i % 2 === 0 ? styles.timelineLeft : styles.timelineRight}`}>
                <div className={styles.timelineCard}>
                  <span className={styles.timelineYear}>{item.year}</span>
                  <h3 className={styles.timelineTitle}>{item.title}</h3>
                  <p className={styles.timelineDesc}>{item.desc}</p>
                </div>
                <div className={styles.timelineDot} />
              </div>
            ))}
            <div className={styles.timelineLine} />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <span className="section-title__eyebrow">What We Stand For</span>
            <h2 className="section-title__heading">Our Values</h2>
            <div className="section-title__ornament"><span className="section-title__ornament-icon">✦</span></div>
          </div>

          <div className={styles.valuesGrid}>
            {values.map((v) => (
              <div key={v.title} className={styles.valueCard}>
                <div className={styles.valueIcon}><v.icon size={24} /></div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className={styles.ctaTitle}>Ready to Experience the Legacy?</h2>
          <p className={styles.ctaDesc}>Order online for delivery, pickup, or visit us at Mohammad Ali Road.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2rem" }}>
            <Link href="/menu" className="btn btn--gold btn--xl">Order Online <ChevronRight size={20} /></Link>
            <Link href="/contact" className="btn btn--secondary btn--xl" style={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}>Find Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
