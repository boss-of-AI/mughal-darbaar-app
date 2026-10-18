import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/menu", "/about", "/contact", "/privacy", "/terms", "/delivery-policy"],
        disallow: ["/dashboard/", "/api/", "/auth/", "/order/", "/t/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
