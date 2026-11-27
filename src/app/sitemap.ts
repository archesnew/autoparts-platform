import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zaptut.pro";
  const now = new Date();

  const publicRoutes = [
    { path: "", changeFrequency: "daily" as const, priority: 1.0 },
    { path: "/catalog", changeFrequency: "hourly" as const, priority: 0.9 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/contacts", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/delivery-info", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/payment-info", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/returns-warranty", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/privacy-policy", changeFrequency: "yearly" as const, priority: 0.5 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.5 },
    { path: "/consent", changeFrequency: "yearly" as const, priority: 0.5 },
  ];

  return publicRoutes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
