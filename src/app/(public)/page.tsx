import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Star,
  Clock,
  Truck,
  ShoppingBag,
  QrCode,
  Award,
  Leaf,
  Flame,
  Phone,
  MapPin,
} from "lucide-react";
import { restaurantConfig } from "@/config/restaurant.config";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: restaurantConfig.seo.defaultTitle,
  description: restaurantConfig.seo.defaultDescription,
};

// ── Featured dishes (pulled from seed — in prod fetched from DB) ──
const featuredDishes = [
  {
    id: "1",
    name: "Royal Dum Biryani",
    description: "Slow-cooked basmati rice layered with tender mutton, saffron, and aged ghee. A 3-hour labour of love.",
    price: 380,
    tag: "Chef's Special",
    tagColor: "gold",
    isVeg: false,
    emoji: "🍛",
    rating: 4.9,
    orders: "2.4k",
  },
  {
    id: "2",
    name: "Seekh Kebab Platter",
    description: "Hand-minced lamb with 14 spices, charcoal-grilled on iron seekhs. Served with laccha onions & mint chutney.",
    price: 320,
    tag: "Bestseller",
    tagColor: "primary",
    isVeg: false,
    emoji: "🥩",
    rating: 4.8,
    orders: "1.8k",
  },
  {
    id: "3",
    name: "Mughlai Paneer Lababdar",
    description: "Cottage cheese in a rich, velvety tomato-cashew gravy infused with Kashmiri spices. A royal vegetarian indulgence.",
    price: 280,
    tag: "Vegetarian",
    tagColor: "veg",
    isVeg: true,
    emoji: "🧀",
    rating: 4.7,
    orders: "1.2k",
  },
  {
    id: "4",
    name: "Shahi Korma",
    description: "Slow-braised chicken in a fragrant almond-cardamom sauce. The crown jewel of Mughal court cuisine.",
    price: 360,
    tag: "Heritage Recipe",
    tagColor: "gold",
    isVeg: false,
    emoji: "🍲",
    rating: 4.9,
    orders: "3.1k",
  },
  {
    id: "5",
    name: "Roomali Roti",
    description: "Gossamer thin bread folded like a handkerchief, baked on an inverted tawa. Perfect for scooping up rich gravies.",
    price: 45,
    tag: "Must Try",
    tagColor: "primary",
    isVeg: true,
    emoji: "🫓",
    rating: 4.6,
    orders: "5.2k",
  },
  {
    id: "6",
    name: "Phirni",
    description: "Classic Mughal rice pudding set in clay pots, garnished with pistachio and edible silver leaf.",
    price: 120,
    tag: "Dessert",
    tagColor: "primary",
    isVeg: true,
    emoji: "🍮",
    rating: 4.8,
    orders: "980",
  },
];

const stats = [
  { value: "500+", label: "Daily Orders", icon: "🍽️" },
  { value: "4.9★", label: "Customer Rating", icon: "⭐" },
  { value: "15+", label: "Years of Legacy", icon: "🏛️" },
  { value: "80+", label: "Menu Items", icon: "📜" },
];

const whyUs = [
  {
    icon: Award,
    title: "Award-Winning Recipes",
    desc: "Our chef's family recipes have won the Best Mughal Cuisine award in Mumbai for 5 consecutive years.",
  },
  {
    icon: Leaf,
    title: "Fresh, Pure Ingredients",
    desc: "We source whole spices daily from Crawford Market. No artificial flavours. No preservatives.",
  },
  {
    icon: Flame,
    title: "Dum Cooking Tradition",
    desc: "Our biryanis are sealed with dough and slow-cooked on charcoal for authentic Dum flavour.",
  },
  {
    icon: Clock,
    title: "Fast & Reliable Delivery",
    desc: `Hot food at your door in ${restaurantConfig.ordering.estimatedDeliveryTime}. We never compromise on temperature or taste.`,
  },
];

const serviceCards = [
  {
    icon: Truck,
    title: "Home Delivery",
    desc: `Delivered in ${restaurantConfig.ordering.estimatedDeliveryTime}`,
    href: "/menu?mode=delivery",
    cta: "Order Delivery",
    color: "primary",
  },
  {
    icon: ShoppingBag,
    title: "Pickup",
    desc: `Ready in ${restaurantConfig.ordering.estimatedPickupTime}`,
    href: "/menu?mode=pickup",
    cta: "Schedule Pickup",
    color: "dark",
  },
  {
    icon: QrCode,
    title: "Dine-In QR",
    desc: "Scan your table QR to order",
    href: "/menu",
    cta: "Scan & Order",
    color: "gold",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className={styles.hero} aria-label="Hero">
        {/* Decorative background pattern */}
        <div className={styles.heroBg} aria-hidden="true">
          <div className={styles.heroBgGradient} />
          <div className={styles.heroBgPattern} />
        </div>

        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>
              ✦ &nbsp; Established 2009, Mohammad Ali Road &nbsp; ✦
            </span>
            <h1 className={styles.heroTitle}>
              A Royal Legacy of
              <br />
              <span className={styles.heroTitleAccent}>Mughal Flavour</span>
            </h1>
            <p className={styles.heroDesc}>
              Experience centuries of Mughal culinary heritage — slow-cooked
              biryanis, smoky kebabs, and fragrant kormas crafted with
              heirloom spices in the heart of Mumbai.
            </p>

            <div className={styles.heroActions}>
              <Link href="/menu" className="btn btn--primary btn--xl">
                Order Now
                <ChevronRight size={20} />
              </Link>
              <Link href="/menu?mode=dine-in" className="btn btn--secondary btn--xl">
                <QrCode size={20} />
                Dine-In Menu
              </Link>
            </div>

            <div className={styles.heroMeta}>
              <div className={styles.heroRating}>
                <div className={styles.heroStars}>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#D4AF37" color="#D4AF37" />
                  ))}
                </div>
                <span>4.9 / 5 &nbsp;·&nbsp; 2,400+ reviews</span>
              </div>
              <span className={styles.heroDivider}>|</span>
              <span className={styles.heroDelivery}>
                <Truck size={14} />
                Free delivery above ₹500
              </span>
            </div>
          </div>

          {/* Hero visual — ornamental card */}
          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.heroCard}>
              <div className={styles.heroCardInner}>
                <span className={styles.heroEmoji}>🍛</span>
                <h3 className={styles.heroCardTitle}>Today&apos;s Special</h3>
                <p className={styles.heroCardItem}>Royal Dum Biryani</p>
                <div className={styles.heroCardPrice}>
                  <span className={styles.heroCardPriceLabel}>Starting at</span>
                  <span className={styles.heroCardPriceValue}>₹380</span>
                </div>
                <Link href="/menu" className="btn btn--gold btn--sm">
                  Add to Cart
                </Link>
              </div>
              {/* Floating badges */}
              <div className={`${styles.floatingBadge} ${styles.floatingBadge1}`}>
                <span>🔥</span> Bestseller
              </div>
              <div className={`${styles.floatingBadge} ${styles.floatingBadge2}`}>
                <span>⚡</span> 35 min
              </div>
              <div className={`${styles.floatingBadge} ${styles.floatingBadge3}`}>
                <Star size={12} fill="#D4AF37" color="#D4AF37" /> 4.9
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className={styles.statsBar}>
          <div className="container">
            <div className={styles.statsGrid}>
              {stats.map((s) => (
                <div key={s.label} className={styles.statItem}>
                  <span className={styles.statIcon}>{s.icon}</span>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Order Modes ───────────────────────────────────────── */}
      <section className={`section ${styles.serviceSection}`} aria-label="Order options">
        <div className="container">
          <div className={styles.serviceGrid}>
            {serviceCards.map((card) => (
              <Link key={card.title} href={card.href} className={`${styles.serviceCard} ${styles[`serviceCard--${card.color}`]}`}>
                <div className={styles.serviceCardIcon}>
                  <card.icon size={28} />
                </div>
                <h2 className={styles.serviceCardTitle}>{card.title}</h2>
                <p className={styles.serviceCardDesc}>{card.desc}</p>
                <span className={styles.serviceCardCta}>
                  {card.cta} <ChevronRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Dishes ───────────────────────────────────── */}
      <section className="section" aria-label="Featured dishes">
        <div className="container">
          <div className="section-title">
            <span className="section-title__eyebrow">From Our Kitchen</span>
            <h2 className="section-title__heading">Signature Dishes</h2>
            <div className="section-title__ornament">
              <span className="section-title__ornament-icon">✦</span>
            </div>
            <p className="section-title__description">
              Each dish is a chapter from the royal kitchens of the Mughal
              empire — perfected over generations and served with pride.
            </p>
          </div>

          <div className={styles.dishGrid}>
            {featuredDishes.map((dish, i) => (
              <article
                key={dish.id}
                className={`${styles.dishCard} animate-fadeInUp`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={styles.dishEmoji} aria-hidden="true">
                  {dish.emoji}
                </div>
                <div className={styles.dishBody}>
                  <div className={styles.dishHeader}>
                    <div
                      className={`veg-dot veg-dot--${dish.isVeg ? "veg" : "nonveg"}`}
                      title={dish.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                      aria-label={dish.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                    />
                    <span
                      className={`badge ${
                        dish.tagColor === "gold"
                          ? "badge--featured"
                          : dish.tagColor === "veg"
                          ? "badge--veg"
                          : "badge--new"
                      }`}
                    >
                      {dish.tag}
                    </span>
                  </div>
                  <h3 className={styles.dishName}>{dish.name}</h3>
                  <p className={styles.dishDesc}>{dish.description}</p>
                  <div className={styles.dishFooter}>
                    <div className={styles.dishRating}>
                      <Star size={12} fill="#D4AF37" color="#D4AF37" />
                      <span>{dish.rating}</span>
                      <span className={styles.dishOrders}>({dish.orders} orders)</span>
                    </div>
                    <div className={styles.dishPriceRow}>
                      <span className="price">₹{dish.price}</span>
                      <Link href={`/menu`} className="btn btn--primary btn--sm">
                        Order
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.viewAllWrap}>
            <Link href="/menu" className="btn btn--secondary btn--lg">
              View Full Menu
              <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ─────────────────────────────────────── */}
      <section className={`section ${styles.whySection}`} aria-label="Why choose us">
        <div className="container">
          <div className={styles.whyInner}>
            <div className={styles.whyLeft}>
              <span className="section-title__eyebrow" style={{textAlign:"left", display:"block"}}>
                Our Promise
              </span>
              <h2 className={styles.whyTitle}>
                The Mughal Darbaar<br />
                <span className={styles.whyTitleAccent}>Difference</span>
              </h2>
              <div className="divider--gold" style={{maxWidth:"120px", margin:"1.5rem 0"}} />
              <p className={styles.whyDesc}>
                We don&apos;t just serve food — we serve a legacy. Every dish
                that leaves our kitchen carries 400 years of Mughal culinary
                wisdom and our family&apos;s 15-year-old obsession with
                perfection.
              </p>
              <Link href="/about" className="btn btn--dark btn--lg" style={{marginTop:"2rem"}}>
                Read Our Story
                <ChevronRight size={18} />
              </Link>
            </div>

            <div className={styles.whyRight}>
              {whyUs.map((item, i) => (
                <div key={item.title} className={styles.whyCard} style={{animationDelay:`${i*100}ms`}}>
                  <div className={styles.whyCardIcon}>
                    <item.icon size={22} />
                  </div>
                  <div>
                    <h3 className={styles.whyCardTitle}>{item.title}</h3>
                    <p className={styles.whyCardDesc}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section className="section" aria-label="Customer reviews">
        <div className="container">
          <div className="section-title">
            <span className="section-title__eyebrow">What They Say</span>
            <h2 className="section-title__heading">Royal Reviews</h2>
            <div className="section-title__ornament">
              <span className="section-title__ornament-icon">✦</span>
            </div>
          </div>

          <div className={styles.reviewGrid}>
            {[
              {
                name: "Amir Sheikh",
                location: "Bandra, Mumbai",
                rating: 5,
                text: "The Dum Biryani here is unlike anything I've had. You can taste the tradition in every grain. Been ordering every Friday for 3 years.",
                avatar: "AS",
              },
              {
                name: "Priya Menon",
                location: "Andheri, Mumbai",
                rating: 5,
                text: "Ordered the Shahi Korma for my family dinner — absolute hit. Everyone kept asking where I ordered from. Delivery was hot and on time!",
                avatar: "PM",
              },
              {
                name: "Rohan Kapoor",
                location: "Powai, Mumbai",
                rating: 5,
                text: "The dine-in QR menu experience is seamless. Scanned, ordered, and food arrived in minutes. The seekh kebabs are phenomenal.",
                avatar: "RK",
              },
            ].map((review) => (
              <article key={review.name} className={styles.reviewCard}>
                <div className={styles.reviewStars}>
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} size={14} fill="#D4AF37" color="#D4AF37" />
                  ))}
                </div>
                <blockquote className={styles.reviewText}>
                  &ldquo;{review.text}&rdquo;
                </blockquote>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAvatar}>{review.avatar}</div>
                  <div>
                    <div className={styles.reviewName}>{review.name}</div>
                    <div className={styles.reviewLocation}>{review.location}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
      <section className={styles.ctaBanner} aria-label="Order call to action">
        <div className={`container ${styles.ctaInner}`}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>
              Hungry? Your Royal Feast<br />
              is Just a Click Away.
            </h2>
            <p className={styles.ctaDesc}>
              Order online for delivery or pickup. Or scan the QR at your
              table for the full dine-in experience.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/menu" className="btn btn--gold btn--xl">
                Order Now — {restaurantConfig.ordering.estimatedDeliveryTime}
                <ChevronRight size={20} />
              </Link>
              <a
                href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`}
                className="btn btn--secondary btn--xl"
                style={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}
              >
                <Phone size={18} />
                Call to Order
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Location ──────────────────────────────────────────── */}
      <section className="section" aria-label="Location and hours">
        <div className="container">
          <div className={styles.locationGrid}>
            <div className={styles.locationInfo}>
              <span className="section-title__eyebrow" style={{textAlign:"left", display:"block"}}>
                Find Us
              </span>
              <h2 className={styles.locationTitle}>Visit Us in Mumbai</h2>
              <div className={styles.locationDetails}>
                <div className={styles.locationItem}>
                  <MapPin size={18} className={styles.locationIcon} />
                  <div>
                    <strong>{restaurantConfig.address.line1}</strong>
                    <br />
                    {restaurantConfig.address.line2 && (
                      <>{restaurantConfig.address.line2}<br /></>
                    )}
                    {restaurantConfig.address.city},{" "}
                    {restaurantConfig.address.pincode}
                  </div>
                </div>
                <div className={styles.locationItem}>
                  <Clock size={18} className={styles.locationIcon} />
                  <div>
                    <strong>Mon – Fri:</strong> {restaurantConfig.hours.weekdays}
                    <br />
                    <strong>Sat – Sun:</strong> {restaurantConfig.hours.weekends}
                  </div>
                </div>
                <div className={styles.locationItem}>
                  <Phone size={18} className={styles.locationIcon} />
                  <a
                    href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`}
                    className={styles.locationLink}
                  >
                    {restaurantConfig.phone}
                  </a>
                </div>
              </div>
              <a
                href={restaurantConfig.address.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary btn--lg"
                style={{ marginTop: "2rem", display: "inline-flex" }}
              >
                <MapPin size={18} />
                Get Directions
              </a>
            </div>

            {/* Map placeholder — replace with Google Maps embed */}
            <div className={styles.mapPlaceholder} aria-label="Restaurant location map">
              <div className={styles.mapOverlay}>
                <MapPin size={40} className={styles.mapPin} />
                <p>{restaurantConfig.name}</p>
                <p className={styles.mapAddress}>{restaurantConfig.address.line1}</p>
                <a
                  href={restaurantConfig.address.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary btn--sm"
                >
                  Open in Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
