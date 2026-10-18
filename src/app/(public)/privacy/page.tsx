import type { Metadata } from "next";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${restaurantConfig.name}. Learn how we collect, use, and protect your personal information when you order online.`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container" style={{ maxWidth: 800, padding: "6rem 1.25rem 4rem" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-3xl)", marginBottom: "1rem" }}>
        Privacy Policy
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem", fontSize: "var(--text-sm)" }}>
        Effective for {restaurantConfig.name} · {restaurantConfig.address.city}, {restaurantConfig.address.state}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", lineHeight: 1.7 }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            1. Information We Collect
          </h2>
          <p>
            When you place an order with {restaurantConfig.name} (online delivery, takeaway pickup, or table QR dine-in),
            we collect only the information needed to prepare, deliver, and support your order: your name, mobile number,
            optional email address, delivery address (for home delivery), and order details.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            2. Payment Security
          </h2>
          <p>
            Online payments are processed securely through Razorpay. {restaurantConfig.name} does not store your credit/debit
            card numbers, CVV, or UPI PIN on our servers. We only store payment reference IDs and status confirmations required
            for accounting and order verification.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            3. How We Use Your Information
          </h2>
          <p>
            We use your contact details solely to coordinate order preparation, delivery, customer support, and receipts.
            We do not sell or rent your personal data to third-party marketers.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            4. Contact Us
          </h2>
          <p>
            For any privacy questions or data deletion requests, please contact {restaurantConfig.name} at{" "}
            <a href={`mailto:${restaurantConfig.email}`} style={{ color: "var(--color-primary)" }}>
              {restaurantConfig.email}
            </a>{" "}
            or call {restaurantConfig.phone}.
          </p>
        </section>
      </div>
    </div>
  );
}
