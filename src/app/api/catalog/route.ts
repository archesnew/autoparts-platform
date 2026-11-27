import "server-only";

import { catalogService } from "@/lib/server/catalog-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const make = searchParams.get("make") ?? undefined;
  const model = searchParams.get("model") ?? undefined;
  const year = searchParams.get("year") ?? undefined;
  const fitmentOnly = searchParams.get("fitmentOnly") === "true";
  const brand = searchParams.get("brand") ?? undefined;
  const condition = searchParams.get("condition") ?? undefined;
  const country = searchParams.get("country") ?? undefined;
  const availability = (searchParams.get("availability") ?? "") as "IN_STOCK" | "ARCHIVED_SOLD" | "";
  const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!, 10) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!, 10) : undefined;
  const sortBy = (searchParams.get("sortBy") as "relevance" | "price_asc" | "price_desc" | "newest") ?? undefined;
  const skip = parseInt(searchParams.get("skip") ?? "0", 10) || 0;
  const take = parseInt(searchParams.get("take") ?? "50", 10) || 50;

  try {
    // Ensure dev catalog is populated on first read
    await catalogService.seedDemoCatalogIfEmpty();

    const result = await catalogService.searchPublic({
      query,
      category,
      make,
      model,
      year,
      fitmentOnly,
      brand,
      condition,
      country,
      availability,
      minPrice,
      maxPrice,
      sortBy,
      skip,
      take,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка при поиске товаров";
    return Response.json({ error: message }, { status: 500 });
  }
}
