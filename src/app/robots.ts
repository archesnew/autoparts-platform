import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isStaging =
    process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
    process.env.BETTER_AUTH_URL?.includes("staging") ||
    process.env.BETTER_AUTH_URL?.includes("netlify.app");

  if (isStaging) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zaptut.pro";

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/catalog",
        "/about",
        "/contacts",
        "/delivery-info",
        "/payment-info",
        "/returns-warranty",
        "/privacy-policy",
        "/terms",
        "/consent",
      ],
      disallow: ["/admin/", "/login", "/account/", "/supplier/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
