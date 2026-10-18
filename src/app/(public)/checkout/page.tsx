import type { Metadata } from "next";
import { db } from "@/lib/db";
import { restaurantSettings } from "@/lib/db/schema";
import CheckoutClient from "./CheckoutClient";

import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

function hasRealRazorpayKeys(keyId?: string | null, keySecret?: string | null): boolean {
  if (!keyId || !keySecret) return false;
  return (
    keyId.startsWith("rzp_") &&
    !keyId.includes("placeholder") &&
    !keySecret.includes("placeholder")
  );
}

export default async function CheckoutPage() {
  let cfg = {
    restaurantName: restaurantConfig.name as string,
    gstRatePct: 5,
    deliveryFeePaise: 4000,
    freeDeliveryAbovePaise: 50000 as number | null,
    minimumOrderPaise: 25000,
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    estimatedDeliveryTime: "30–45 minutes",
    estimatedPickupTime: "15–20 minutes",
    onlinePaymentEnabled: hasRealRazorpayKeys(
      process.env.RAZORPAY_KEY_ID,
      process.env.RAZORPAY_KEY_SECRET
    ),
  };
  try {
    const [s] = await db.select().from(restaurantSettings).limit(1);
    if (s) {
      const keyId = s.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "";
      const keySecret = s.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || "";
      cfg = {
        restaurantName: s.name || restaurantConfig.name,
        gstRatePct: Number(s.gstRatePct),
        deliveryFeePaise: s.deliveryFeePaise,
        freeDeliveryAbovePaise: s.freeDeliveryAbovePaise,
        minimumOrderPaise: s.minimumOrderPaise,
        deliveryEnabled: s.deliveryEnabled,
        pickupEnabled: s.pickupEnabled,
        dineInEnabled: s.dineInEnabled,
        estimatedDeliveryTime: s.estimatedDeliveryTime ?? cfg.estimatedDeliveryTime,
        estimatedPickupTime: s.estimatedPickupTime ?? cfg.estimatedPickupTime,
        onlinePaymentEnabled: hasRealRazorpayKeys(keyId, keySecret),
      };
    }
  } catch {
    /* DB offline — defaults */
  }
  return <CheckoutClient cfg={cfg} />;
}
