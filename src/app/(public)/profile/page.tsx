import type { Metadata } from "next";
import { restaurantConfig } from "@/config/restaurant.config";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: `My Profile & Order History — ${restaurantConfig.name}`,
  description: "View your saved profile, live order status, and complete order history.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
