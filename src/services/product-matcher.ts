import {
  StreetPricerProduct,
  WooCommerceProduct,
  ShopifyVariant,
  ProductMatch,
  ProductMatchResult
} from '../types/index.js';

export interface IProductMatcher {
  matchProducts(
    streetPricerProducts: StreetPricerProduct[],
    platformProducts: (WooCommerceProduct | ShopifyVariant)[]
  ): ProductMatchResult;
}

export class ProductMatcher implements IProductMatcher {
  /**
   * Matches StreetPricer products with e-commerce platform products using SKU-based matching
   * 
   * Matching Algorithm:
   * 1. Exact SKU match (confidence: 1.0) - Case-sensitive comparison
   * 2. Normalized SKU match (confidence: 0.9) - Remove spaces, hyphens, convert to lowercase
   * 3. Products without SKU are automatically categorized as unlisted
   */
  matchProducts(
    streetPricerProducts: StreetPricerProduct[],
    platformProducts: (WooCommerceProduct | ShopifyVariant)[]
  ): ProductMatchResult {
    const matched: ProductMatch[] = [];
    const unlisted: StreetPricerProduct[] = [];

    // Create lookup maps for platform products by SKU
    const exactSkuMap = new Map<string, WooCommerceProduct | ShopifyVariant>();
    const normalizedSkuMap = new Map<string, WooCommerceProduct | ShopifyVariant>();

    // Build lookup maps for platform products
    for (const platformProduct of platformProducts) {
      const sku = platformProduct.sku;

      // Skip products without SKU
      if (!sku || sku.trim() === '') {
        continue;
      }

      // Exact SKU mapping (keep first occurrence for duplicates)
      if (!exactSkuMap.has(sku)) {
        exactSkuMap.set(sku, platformProduct);
      }

      // Normalized SKU mapping (keep first occurrence for duplicates)
      const normalizedSku = this.normalizeSku(sku);
      if (normalizedSku && !normalizedSkuMap.has(normalizedSku)) {
        normalizedSkuMap.set(normalizedSku, platformProduct);
      }
    }

    // Match StreetPricer products
    for (const streetPricerProduct of streetPricerProducts) {
      const sku = streetPricerProduct.sku;

      // Products without SKU are categorized as unlisted
      if (!sku || sku.trim() === '') {
        unlisted.push(streetPricerProduct);
        continue;
      }

      let matchedProduct: WooCommerceProduct | ShopifyVariant | undefined;
      let confidence: number = 0;

      // Try exact SKU match first
      matchedProduct = exactSkuMap.get(sku);
      if (matchedProduct) {
        confidence = 1.0;
      } else {
        // Try normalized SKU match
        const normalizedSku = this.normalizeSku(sku);
        if (normalizedSku) {
          matchedProduct = normalizedSkuMap.get(normalizedSku);
          if (matchedProduct) {
            confidence = 0.9;
          }
        }
      }

      if (matchedProduct) {
        matched.push({
          streetPricerProduct,
          platformProduct: matchedProduct,
          matchConfidence: confidence
        });
      } else {
        unlisted.push(streetPricerProduct);
      }
    }

    return {
      matched,
      unlisted
    };
  }

  /**
   * Normalizes SKU by removing spaces, hyphens, and converting to lowercase
   * Returns null if the normalized SKU would be empty
   */
  private normalizeSku(sku: string): string | null {
    if (!sku) {
      return null;
    }

    const normalized = sku
      .toLowerCase()
      .replace(/[\s-]/g, '') // Remove spaces and hyphens
      .trim();

    return normalized === '' ? null : normalized;
  }
}