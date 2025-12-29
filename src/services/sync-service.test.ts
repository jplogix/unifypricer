import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as fc from 'fast-check';
import { SyncService } from './sync-service.js';
import { IStreetPricerClient } from '../clients/streetpricer.js';
import { ProductMatcher } from './product-matcher.js';
import { StatusRepository } from '../repositories/status.js';
import {
    Store,
    WooCommerceProduct,
    ShopifyVariant,
    StreetPricerProduct
} from '../types/index.js';

describe('SyncService', () => {
    let syncService: SyncService;
    let mockStreetPricer: any;
    let mockProductMatcher: any;
    let mockStatusRepo: any;
    let mockAuditRepo: any;
    let mockWooClient: any;
    let mockShopifyClient: any;
    let platformClients: any;

    beforeEach(() => {
        mockStreetPricer = {
            fetchAllProducts: mock(() => Promise.resolve([]))
        };
        mockProductMatcher = {
            matchProducts: mock(() => ({ matched: [], unlisted: [] }))
        };
        mockStatusRepo = {
            updateProductStatus: mock(() => Promise.resolve()),
            saveSyncResult: mock(() => Promise.resolve())
        };
        mockAuditRepo = {  // Initialize mock
            log: mock(() => Promise.resolve())
        };

        mockWooClient = {
            authenticate: mock(() => Promise.resolve()),
            getAllProducts: mock(() => Promise.resolve([])),
            updateProductPrice: mock(() => Promise.resolve())
        };

        mockShopifyClient = {
            authenticate: mock(() => Promise.resolve()),
            getAllProducts: mock(() => Promise.resolve([])),
            updateProductPrice: mock(() => Promise.resolve())
        };

        platformClients = {
            woocommerce: () => mockWooClient,
            shopify: () => mockShopifyClient
        };

        syncService = new SyncService(
            mockStreetPricer,
            mockProductMatcher,
            mockStatusRepo,
            mockAuditRepo, // Pass mock
            platformClients
        );
    });

    describe('Property-Based Tests', () => {
        // Feature: price-sync-dashboard, Property 10.2: Price update on difference
        // Validates: Requirement 4.1, 5.1
        it('Property 10.2: For any matched products with price difference > threshold, system should trigger update', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.double({ min: 0.01, max: 1000 }), // current price
                    fc.double({ min: 0.01, max: 1000 }), // target price
                    async (currentPrice, targetPrice) => {
                        // Setup
                        const store: Store = {
                            id: 'store-1', name: 'Store', platform: 'woocommerce',
                            syncInterval: 60, enabled: true,
                            createdAt: new Date(), updatedAt: new Date()
                        } as any; // simplified

                        mockStreetPricer.fetchAllProducts.mockResolvedValue([{
                            id: 'sp-1', sku: 'SKU1', price: targetPrice, name: 'P1', currency: 'USD', lastUpdated: new Date()
                        }]);

                        mockWooClient.getAllProducts.mockResolvedValue([{
                            id: 1, sku: 'SKU1', price: String(currentPrice), name: 'P1', regularPrice: String(currentPrice)
                        }]);

                        // Configure matcher to return match
                        mockProductMatcher.matchProducts.mockReturnValue({
                            matched: [{
                                streetPricerProduct: { id: 'sp-1', sku: 'SKU1', price: targetPrice },
                                platformProduct: { id: 1, sku: 'SKU1', price: String(currentPrice) },
                                matchConfidence: 1.0
                            }],
                            unlisted: []
                        });

                        mockWooClient.updateProductPrice.mockClear();

                        await syncService.syncStore(store);

                        if (Math.abs(currentPrice - targetPrice) > 0.01) {
                            expect(mockWooClient.updateProductPrice).toHaveBeenCalled();
                        } else {
                            expect(mockWooClient.updateProductPrice).not.toHaveBeenCalled();
                        }
                    }
                )
            );
        });

        // Feature: price-sync-dashboard, Property 10.3: Successful update recording
        // Validates: Requirement 4.2, 5.2
        it('Property 10.3: Successful price updates must be recorded with repriced status', async () => {
            // Similar property test but asserting statusRepo.updateProductStatus call params
            await fc.assert(
                fc.asyncProperty(
                    fc.double({ min: 0, max: 1000 }),
                    async (price) => {
                        const targetPrice = price + 10; // Ensure diff
                        const store: Store = {
                            id: 'store-1', name: 'Store', platform: 'woocommerce',
                            syncInterval: 60, enabled: true, createdAt: new Date(), updatedAt: new Date()
                        } as any;

                        mockProductMatcher.matchProducts.mockReturnValue({
                            matched: [{
                                streetPricerProduct: { id: 'sp-1', sku: 'SKU1', price: targetPrice },
                                platformProduct: { id: 1, sku: 'SKU1', price: String(price) },
                                matchConfidence: 1.0
                            }],
                            unlisted: []
                        });

                        mockWooClient.updateProductPrice.mockResolvedValue(true);
                        mockStatusRepo.updateProductStatus.mockClear();

                        await syncService.syncStore(store);

                        expect(mockStatusRepo.updateProductStatus).toHaveBeenCalledWith(
                            'store-1', '1', 'sp-1', expect.anything(), 'repriced', expect.any(Number), targetPrice
                        );
                    }
                )
            );
        });

        // Feature: price-sync-dashboard, Property 10.4: Failed update handling
        // Validates: Requirement 4.3, 5.3
        it('Property 10.4: Failed price updates must be recorded with pending status and error message', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1 }), // Error message
                    async (errorMessage) => {
                        const store: Store = {
                            id: 'store-1', name: 'Store', platform: 'woocommerce',
                            syncInterval: 60, enabled: true, createdAt: new Date(), updatedAt: new Date()
                        } as any;

                        mockProductMatcher.matchProducts.mockReturnValue({
                            matched: [{
                                streetPricerProduct: { id: 'sp-1', sku: 'SKU1', price: 20 },
                                platformProduct: { id: 1, sku: 'SKU1', price: "10" },
                                matchConfidence: 1.0
                            }],
                            unlisted: []
                        });

                        mockWooClient.updateProductPrice.mockRejectedValue(new Error(errorMessage));
                        mockStatusRepo.updateProductStatus.mockClear();

                        await syncService.syncStore(store);

                        expect(mockStatusRepo.updateProductStatus).toHaveBeenCalledWith(
                            'store-1', '1', 'sp-1', expect.anything(), 'pending', expect.any(Number), 20, errorMessage
                        );
                    }
                )
            );
        });
    });
});
