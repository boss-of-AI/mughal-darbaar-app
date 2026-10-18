import type { Metadata } from "next";
import { db } from "@/lib/db";
import { restaurantSettings } from "@/lib/db/schema";
import { restaurantConfig } from "@/config/restaurant.config";
import SettingsClient, { type InitialSettings } from "./SettingsClient";

export const metadata: Metadata = { title: `Settings — ${restaurantConfig.name}` };
export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  let initial: InitialSettings = {
    name: restaurantConfig.name,
    tagline: restaurantConfig.tagline,
    phone: restaurantConfig.phone,
    email: restaurantConfig.email,
    gstin: "",
    fssaiNumber: "",
    gstRatePct: 5,
    minimumOrderRupees: restaurantConfig.ordering.minimumOrderAmount / 100,
    deliveryFeeRupees: restaurantConfig.ordering.deliveryFee / 100,
    freeDeliveryAboveRupees: restaurantConfig.ordering.freeDeliveryAbove / 100,
    estimatedDeliveryTime: restaurantConfig.ordering.estimatedDeliveryTime,
    estimatedPickupTime: restaurantConfig.ordering.estimatedPickupTime,
    deliveryEnabled: restaurantConfig.services.delivery,
    pickupEnabled: restaurantConfig.services.pickup,
    dineInEnabled: restaurantConfig.services.dineIn,
    razorpayKeyId: "",
    hasRazorpaySecret: false,
  };

  try {
    const [s] = await db.select().from(restaurantSettings).limit(1);
    if (s) {
      initial = {
        name: s.name,
        tagline: s.tagline ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        gstin: s.gstin ?? "",
        fssaiNumber: s.fssaiNumber ?? "",
        gstRatePct: Number(s.gstRatePct),
        minimumOrderRupees: s.minimumOrderPaise / 100,
        deliveryFeeRupees: s.deliveryFeePaise / 100,
        freeDeliveryAboveRupees:
          s.freeDeliveryAbovePaise != null ? s.freeDeliveryAbovePaise / 100 : 0,
        estimatedDeliveryTime: s.estimatedDeliveryTime ?? "30–45 minutes",
        estimatedPickupTime: s.estimatedPickupTime ?? "15–20 minutes",
        deliveryEnabled: s.deliveryEnabled,
        pickupEnabled: s.pickupEnabled,
        dineInEnabled: s.dineInEnabled,
        razorpayKeyId: s.razorpayKeyId ?? "",
        hasRazorpaySecret: Boolean(s.razorpayKeySecret),
      };
    }
  } catch {
    // DB not connected yet — falls back to restaurantConfig defaults
  }

  return <SettingsClient initial={initial} />;
}
