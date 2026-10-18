import type { Metadata } from "next";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service and ordering conditions for ${restaurantConfig.name}.`,
};

export default function TermsPage() {
  return (
    <div className="container" style={{ maxWidth: 800, padding: "6rem 1.25rem 4rem" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-3xl)", marginBottom: "1rem" }}>
        Terms of Service
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem", fontSize: "var(--text-sm)" }}>
        {restaurantConfig.name} · {restaurantConfig.address.line1}, {restaurantConfig.address.city}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", lineHeight: 1.7 }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            1. Ordering &amp; Acceptance
          </h2>
          <p>
            All orders placed through this website or via our in-restaurant table QR codes are subject to acceptance and
            kitchen availability at {restaurantConfig.name}. Prices and applicable GST are calculated and displayed clearly
            before you confirm your order.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            2. Pricing &amp; Taxes
          </h2>
          <p>
            All menu prices are listed in Indian Rupees (INR). Applicable Goods and Services Tax (GST) and delivery charges
            (where applicable) are shown as separate line items on the checkout screen prior to order placement.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            3. Cancellations &amp; Refunds
          </h2>
          <p>
            Once an order is marked as &ldquo;Preparing&rdquo; by the kitchen, it cannot be cancelled. If {restaurantConfig.name} is
            unable to fulfil a prepaid online order, a full refund will be initiated to your original payment method within
            5–7 business days. For quality issues or missing items, please contact us immediately at {restaurantConfig.phone}.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            4. Dine-In QR Orders
          </h2>
          <p>
            Table QR orders are intended exclusively for guests seated at {restaurantConfig.name}. Payment for dine-in orders
            is settled directly at the restaurant counter unless otherwise specified.
          </p>
        </section>
      </div>
    </div>
  );
}
