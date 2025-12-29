import { describe, it, expect } from 'bun:test';
import * as fc from 'fast-check';
import { ProductMatcher } from './product-matcher.js';
import {
  StreetPricerProduct,
  WooCommerceProduct,
  ShopifyVariant
} from '../types/index.js';

describe('ProductMatcher', () => {
  const matcher = new ProductMatcher();

  // Helper functions to create test data
  const createStreetPricerProduct = (id: string, sku: string, name: string = 'Test Product'): StreetPricerProduct => ({
    id,
    sku,
    name,
    price: 10.99,
    currency: 'USD',
    lastUpdated: new Date()
  });

  const createWooCommerceProduct = (id: number, sku: string, name: string = 'Test Product'): WooCommerceProduct => ({
    id,
    sku,
    name,
    price: '9.99',
    regularPrice: '9.99'
  });

  const createShopifyVariant = (id: number, sku: string, title: string = 'Test Variant'): ShopifyVariant => ({
    id,
    sku,
    title,
    price: '9.99'
  });

  describe('exact SKU matching', () => {
    it('should match products with identical SKUs (case-sensitive)', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123'),
        createStreetPricerProduct('sp2', 'XYZ789')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123'),
        createWooCommerceProduct(2, 'XYZ789')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(2);
      expect(result.unlisted).toHaveLength(0);

      // Check first match
      expect(result.matched[0].streetPricerProduct.sku).toBe('ABC123');
      expect(result.matched[0].platformProduct.sku).toBe('ABC123');
      expect(result.matched[0].matchConfidence).toBe(1.0);

      // Check second match
      expect(result.matched[1].streetPricerProduct.sku).toBe('XYZ789');
      expect(result.matched[1].platformProduct.sku).toBe('XYZ789');
      expect(result.matched[1].matchConfidence).toBe(1.0);
    });

    it('should not match products with different case SKUs in exact matching', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'abc123') // lowercase
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      // Should not match exactly, but should match with normalized matching
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(0.9); // normalized match
      expect(result.unlisted).toHaveLength(0);
    });

    it('should work with Shopify variants', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'VARIANT123')
      ];

      const platformProducts = [
        createShopifyVariant(1, 'VARIANT123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(1.0);
      expect(result.unlisted).toHaveLength(0);
    });
  });

  describe('normalized SKU matching', () => {
    it('should match products with case-insensitive SKUs', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'abc123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(0.9);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should match products after removing spaces', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC 123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(0.9);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should match products after removing hyphens', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC-123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(0.9);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should match products with complex normalization', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC-123 XYZ')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'abc123xyz')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(0.9);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should prefer exact matches over normalized matches', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123'), // exact match
        createWooCommerceProduct(2, 'abc123')  // normalized match
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchConfidence).toBe(1.0); // Should prefer exact match
      expect(result.matched[0].platformProduct.id).toBe(1); // Should match the exact one
      expect(result.unlisted).toHaveLength(0);
    });
  });

  describe('unlisted product handling', () => {
    it('should categorize StreetPricer products without SKU as unlisted', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', ''), // empty SKU
        createStreetPricerProduct('sp2', '   '), // whitespace SKU
        { ...createStreetPricerProduct('sp3', 'ABC123'), sku: null as any } // null SKU
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(0);
      expect(result.unlisted).toHaveLength(3);
      expect(result.unlisted.map(p => p.id)).toEqual(['sp1', 'sp2', 'sp3']);
    });

    it('should categorize StreetPricer products with no matching platform product as unlisted', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123'),
        createStreetPricerProduct('sp2', 'NOMATCH')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].streetPricerProduct.id).toBe('sp1');
      expect(result.unlisted).toHaveLength(1);
      expect(result.unlisted[0].id).toBe('sp2');
    });

    it('should ignore platform products without SKU', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, ''), // empty SKU
        createWooCommerceProduct(2, '   '), // whitespace SKU
        { ...createWooCommerceProduct(3, 'ABC123'), sku: null as any }, // null SKU
        createWooCommerceProduct(4, 'ABC123') // valid SKU
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].platformProduct.id).toBe(4); // Should match the valid one
      expect(result.unlisted).toHaveLength(0);
    });
  });

  describe('mixed platform products', () => {
    it('should handle both WooCommerce and Shopify products', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'WOO123'),
        createStreetPricerProduct('sp2', 'SHOPIFY456')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'WOO123'),
        createShopifyVariant(2, 'SHOPIFY456')
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(2);
      expect(result.unlisted).toHaveLength(0);

      // Check WooCommerce match
      const wooMatch = result.matched.find(m => m.streetPricerProduct.id === 'sp1');
      expect(wooMatch).toBeDefined();
      expect(wooMatch!.matchConfidence).toBe(1.0);

      // Check Shopify match
      const shopifyMatch = result.matched.find(m => m.streetPricerProduct.id === 'sp2');
      expect(shopifyMatch).toBeDefined();
      expect(shopifyMatch!.matchConfidence).toBe(1.0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input arrays', () => {
      const result = matcher.matchProducts([], []);

      expect(result.matched).toHaveLength(0);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should handle empty StreetPricer products array', () => {
      const platformProducts = [
        createWooCommerceProduct(1, 'ABC123')
      ];

      const result = matcher.matchProducts([], platformProducts);

      expect(result.matched).toHaveLength(0);
      expect(result.unlisted).toHaveLength(0);
    });

    it('should handle empty platform products array', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'ABC123')
      ];

      const result = matcher.matchProducts(streetPricerProducts, []);

      expect(result.matched).toHaveLength(0);
      expect(result.unlisted).toHaveLength(1);
      expect(result.unlisted[0].id).toBe('sp1');
    });

    it('should handle duplicate SKUs in platform products (first one wins)', () => {
      const streetPricerProducts = [
        createStreetPricerProduct('sp1', 'DUPLICATE')
      ];

      const platformProducts = [
        createWooCommerceProduct(1, 'DUPLICATE'),
        createWooCommerceProduct(2, 'DUPLICATE') // duplicate SKU
      ];

      const result = matcher.matchProducts(streetPricerProducts, platformProducts);

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].platformProduct.id).toBe(1); // Should match the first one
      expect(result.unlisted).toHaveLength(0);
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: price-sync-dashboard, Property 8: Product count invariant
    // Validates: Requirement 2.4, 3.4
    it('Property 8: The sum of matched and unlisted products must equal the total number of valid StreetPricer products processed', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            id: fc.string(),
            sku: fc.string(),
            name: fc.string(),
            price: fc.double(),
            currency: fc.constant('USD'),
            lastUpdated: fc.constant(new Date())
          })),
          fc.array(fc.record({
            id: fc.nat(),
            sku: fc.string(),
            name: fc.string(),
            price: fc.string(),
            regularPrice: fc.string()
          })),
          (spProducts, wpProducts) => {
            const result = matcher.matchProducts(spProducts, wpProducts);
            expect(result.matched.length + result.unlisted.length).toBe(spProducts.length);
          }
        )
      );
    });

    // Feature: price-sync-dashboard, Property 5: SKU matching
    // Validates: Requirement 2.1, 3.1
    it('Property 5: For any pair of products with identical normalized SKUs, the system should strictly link them', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // SKU
          (sku) => {
            const spProduct = createStreetPricerProduct('sp1', sku);
            const wpProduct = createWooCommerceProduct(1, sku);

            const result = matcher.matchProducts([spProduct], [wpProduct]);

            expect(result.matched).toHaveLength(1);
            expect(result.matched[0].streetPricerProduct.id).toBe('sp1');
            expect(result.matched[0].platformProduct.id).toBe(1);
          }
        )
      );
    });

    // Feature: price-sync-dashboard, Property 7: Unlisted categorization
    // Validates: Requirement 2.3, 3.3
    it('Property 7: Any StreetPricer product whose SKU does not match any store product must be categorized as unlisted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // SKU 1
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // SKU 2
          (sku1, sku2) => {
            // Ensure SKUs are distinct even after normalization to guarantee no match
            fc.pre(sku1.toLowerCase().replace(/[\s-]/g, '') !== sku2.toLowerCase().replace(/[\s-]/g, ''));

            const spProduct = createStreetPricerProduct('sp1', sku1);
            const wpProduct = createWooCommerceProduct(1, sku2);

            const result = matcher.matchProducts([spProduct], [wpProduct]);

            expect(result.matched).toHaveLength(0);
            expect(result.unlisted).toHaveLength(1);
            expect(result.unlisted[0].id).toBe('sp1');
          }
        )
      );
    });
  });
});