import type { Metadata } from "next";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = {
  title: "Delivery & Pickup Policy",
  description: `Delivery times, minimum order, and takeaway pickup policy for ${restaurantConfig.name}.`,
};

export default function DeliveryPolicyPage() {
  const minRupees = restaurantConfig.ordering.minimumOrderAmount / 100;
  const feeRupees = restaurantConfig.ordering.deliveryFee / 100;
  const freeAboveRupees = restaurantConfig.ordering.freeDeliveryAbove / 100;

  return (
    <div className="container" style={{ maxWidth: 800, padding: "6rem 1.25rem 4rem" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-3xl)", marginBottom: "1rem" }}>
        Delivery &amp; Pickup Policy
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem", fontSize: "var(--text-sm)" }}>
        Direct ordering from {restaurantConfig.name}, {restaurantConfig.address.city}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", lineHeight: 1.7 }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            1. Delivery Areas &amp; Fleet
          </h2>
          <p>
            {restaurantConfig.name} manages deliveries directly using our own dedicated delivery staff from{" "}
            {restaurantConfig.address.line1}, {restaurantConfig.address.city} ({restaurantConfig.address.pincode}).
            Please ensure your mobile number and landmark details are accurate so our rider can reach you promptly.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            2. Minimum Order &amp; Delivery Charges
          </h2>
          <p>
            The standard minimum order for home delivery is ₹{minRupees}. A nominal delivery charge of ₹{feeRupees} applies
            to orders below ₹{freeAboveRupees}, and delivery is free on orders of ₹{freeAboveRupees} and above (subject to
            current restaurant settings shown at checkout).
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            3. Estimated Preparation &amp; Delivery Times
          </h2>
          <p>
            Typical home delivery time is {restaurantConfig.ordering.estimatedDeliveryTime}, and takeaway pickup orders are
            typically ready in {restaurantConfig.ordering.estimatedPickupTime}. During peak dinner hours, weekends, or
            heavy Mumbai monsoon conditions, delivery times may vary slightly.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            4. Support
          </h2>
          <p>
            Need help with an active delivery or pickup order? Call us directly at{" "}
            <a href={`tel:${restaurantConfig.phone.replace(/\s/g, "")}`} style={{ color: "var(--color-primary)" }}>
              {restaurantConfig.phone}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
