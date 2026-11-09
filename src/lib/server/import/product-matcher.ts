import type { NormalizedFeedItem } from "./field-normalizer.ts";
import { prisma } from "../db.ts";

export type MatchResult = {
  matchType: "NEW_PRODUCT" | "MATCHED_EXISTING" | "AMBIGUOUS" | "DUPLICATE_IN_FEED" | "ERROR";
  matchedProductId?: string;
  matchedOfferId?: string;
  errors: string[];
};

export class ProductMatcher {
  private feedSeenKeys = new Set<string>();

  resetFeedCache() {
    this.feedSeenKeys.clear();
  }

  async matchRow(
    item: NormalizedFeedItem,
    supplierId: string,
    source: string
  ): Promise<MatchResult> {
    if (item.validationErrors.length > 0) {
      return {
        matchType: "ERROR",
        errors: item.validationErrors,
      };
    }

    // Check duplicate in current feed upload
    const feedKey = `${item.externalId || item.normalizedOem || item.title}`;
    if (this.feedSeenKeys.has(feedKey)) {
      return {
        matchType: "DUPLICATE_IN_FEED",
        errors: ["Позиция дублируется внутри текущего файла импорта"],
      };
    }
    this.feedSeenKeys.add(feedKey);

    // 1. Check if SupplierOffer already exists for this supplier + externalId
    let existingOffer = null;
    if (item.externalId) {
      existingOffer = await prisma.supplierOffer.findUnique({
        where: {
          supplierId_source_externalId: {
            supplierId,
            source,
            externalId: item.externalId,
          },
        },
        select: { id: true, productId: true },
      });
    }

    if (existingOffer) {
      return {
        matchType: "MATCHED_EXISTING",
        matchedProductId: existingOffer.productId,
        matchedOfferId: existingOffer.id,
        errors: [],
      };
    }

    // 2. Search existing Product by OEM / alternative articles
    if (item.normalizedOem) {
      const candidates = await prisma.product.findMany({
        where: {
          OR: [
            { primaryOem: { equals: item.rawOem || item.normalizedOem, mode: "insensitive" } },
            { primaryOem: { equals: item.normalizedOem, mode: "insensitive" } },
            { oemCodes: { has: item.normalizedOem } },
            { oemCodes: { has: item.rawOem || item.normalizedOem } },
            { altArticles: { has: item.normalizedOem } },
          ],
        },
        select: { id: true, brand: true, category: true, primaryOem: true },
      });

      if (candidates.length === 1) {
        return {
          matchType: "MATCHED_EXISTING",
          matchedProductId: candidates[0].id,
          errors: [],
        };
      }

      if (candidates.length > 1) {
        // Filter by brand alignment if available
        const brandMatches = candidates.filter(
          (c) => c.brand.toUpperCase() === item.brand.toUpperCase()
        );
        if (brandMatches.length === 1) {
          return {
            matchType: "MATCHED_EXISTING",
            matchedProductId: brandMatches[0].id,
            errors: [],
          };
        }

        // Multiple distinct conflicting products share this OEM
        return {
          matchType: "AMBIGUOUS",
          errors: [
            `Найдено ${candidates.length} разных карточек товара для артикула '${item.rawOem}'. Требуется ручное подтверждение.`,
          ],
        };
      }
    }

    // 3. No match found -> new product
    return {
      matchType: "NEW_PRODUCT",
      errors: [],
    };
  }
}
