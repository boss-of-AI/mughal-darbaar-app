import type { Metadata, Viewport } from "next";
import "./globals.css";
import { restaurantConfig } from "@/config/restaurant.config";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: restaurantConfig.seo.defaultTitle,
    template: restaurantConfig.seo.titleTemplate,
  },
  description: restaurantConfig.seo.defaultDescription,
  applicationName: restaurantConfig.seo.siteName,
  keywords: [
    restaurantConfig.name,
    restaurantConfig.cuisine,
    "online food order",
    "restaurant Mumbai",
    "biryani",
    "kebab",
    "Mughal food",
    "food delivery Mumbai",
  ],
  authors: [{ name: restaurantConfig.name }],
  creator: restaurantConfig.name,
  publisher: restaurantConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: restaurantConfig.seo.locale,
    siteName: restaurantConfig.seo.siteName,
    title: restaurantConfig.seo.defaultTitle,
    description: restaurantConfig.seo.defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    site: restaurantConfig.seo.twitterHandle,
    creator: restaurantConfig.seo.twitterHandle,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#C41E3A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Structured Data — Restaurant Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: restaurantConfig.name,
              description: restaurantConfig.description,
              servesCuisine: restaurantConfig.cuisine,
              telephone: restaurantConfig.phone,
              email: restaurantConfig.email,
              address: {
                "@type": "PostalAddress",
                streetAddress: restaurantConfig.address.line1,
                addressLocality: restaurantConfig.address.city,
                addressRegion: restaurantConfig.address.state,
                postalCode: restaurantConfig.address.pincode,
                addressCountry: "IN",
              },
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                  ],
                  opens: "12:00",
                  closes: "23:30",
                },
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Saturday", "Sunday"],
                  opens: "11:00",
                  closes: "00:00",
                },
              ],
              hasMenu: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/menu`,
              acceptsReservations: "False",
              priceRange: "₹₹",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
