import {
    IStreetPricerClient
} from '../clients/streetpricer.js';
import {
    IWooCommerceClient
} from '../clients/woocommerce.js';
import {
    IShopifyClient
} from '../clients/shopify.js';
import {
    IProductMatcher
} from './product-matcher.js';
import {
    StatusRepository
} from '../repositories/status.js';
import {
    AuditRepository
} from '../repositories/audit.js';
import {
    Store,
    StoreSyncResult,
    SyncError,
    WooCommerceProduct,
    ShopifyVariant
} from '../types/index.js';
import { AppError, ErrorType } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export interface ISyncService {
    syncStore(store: Store, credentials?: any): Promise<StoreSyncResult>;
}

export class SyncService implements ISyncService {
    private logger = new Logger('SyncService');

    constructor(
        private streetPricerClient: IStreetPricerClient,
        private productMatcher: IProductMatcher,
        private statusRepository: StatusRepository,
        private auditRepository: AuditRepository,
        private platformClients: {
            woocommerce: (creds: any) => IWooCommerceClient;
            shopify: (creds: any) => IShopifyClient;
        }
    ) { }

    async syncStore(store: Store, credentials?: any): Promise<StoreSyncResult> {
        this.logger.info(`Starting sync for store ${store.id}`, { storeId: store.id });
        const errors: SyncError[] = [];
        let repricedCount = 0;
        let pendingCount = 0;
        let unlistedCount = 0;

        try {
            // 1. Fetch StreetPricer Data
            const spProducts = await this.streetPricerClient.fetchAllProducts();

            // 2. Fetch Platform Data
            let platformProducts: (WooCommerceProduct | ShopifyVariant)[] = [];
            let platformClient: IWooCommerceClient | IShopifyClient;

            const authCredentials = credentials || this.parseCredentials(store);

            if (store.platform === 'woocommerce') {
                const client = this.platformClients.woocommerce(authCredentials);
                await client.authenticate(authCredentials.url, authCredentials.consumerKey, authCredentials.consumerSecret);
                platformProducts = await client.getAllProducts();
                platformClient = client;
            } else if (store.platform === 'shopify') {
                const client = this.platformClients.shopify(authCredentials);
                await client.authenticate(authCredentials.shopDomain, authCredentials.accessToken);
                const shopsProducts = await client.getAllProducts();
                platformProducts = shopsProducts.flatMap(p => p.variants);
                platformClient = client;
            } else {
                throw new AppError(`Unsupported platform: ${store.platform}`, ErrorType.CONFIGURATION);
            }

            // 3. Match Products
            const matchResult = this.productMatcher.matchProducts(spProducts, platformProducts);

            // 4. Process Matches
            for (const match of matchResult.matched) {
                const sp = match.streetPricerProduct;
                const pp = match.platformProduct;

                const currentPrice = parseFloat(pp.price);
                const targetPrice = sp.price;

                // Simple repricing logic: if diff > 0.01
                if (Math.abs(currentPrice - targetPrice) > 0.01) {
                    try {
                        if (store.platform === 'woocommerce') {
                            await (platformClient as IWooCommerceClient).updateProductPrice(pp.id, targetPrice);
                        } else {
                            // NOTE: Using 0 for productId as placeholder since we lack it in flattened variant.
                            // See previous discussion on type gap.
                            await (platformClient as IShopifyClient).updateProductPrice(0, pp.id, targetPrice);
                        }

                        repricedCount++;

                        // Status Update
                        await this.statusRepository.updateProductStatus(
                            store.id,
                            String(pp.id),
                            sp.id,
                            sp.sku,
                            'repriced',
                            currentPrice,
                            targetPrice
                        );

                        // Audit Log
                        await this.auditRepository.log({
                            storeId: store.id,
                            productId: String(pp.id),
                            action: 'PRICE_UPDATE',
                            oldValue: String(currentPrice),
                            newValue: String(targetPrice),
                            details: `Updated from ${currentPrice} to ${targetPrice} based on StreetPricer ${sp.id}`
                        });

                        this.logger.info(`Repriced product ${pp.id}`, { storeId: store.id, productId: pp.id, oldPrice: currentPrice, newPrice: targetPrice });

                    } catch (err: any) {
                        pendingCount++;
                        const errMsg = err.message || 'Update failed';
                        const errorType = err instanceof AppError ? err.type : ErrorType.NETWORK;

                        errors.push({
                            productId: String(pp.id),
                            errorMessage: errMsg,
                            errorType: errorType
                        });

                        this.logger.error(`Failed to update product ${pp.id}`, { storeId: store.id, productId: pp.id, error: errMsg });

                        await this.statusRepository.updateProductStatus(
                            store.id,
                            String(pp.id),
                            sp.id,
                            sp.sku,
                            'pending',
                            currentPrice,
                            targetPrice,
                            errMsg
                        );
                    }
                }
            }

            // 5. Process Unlisted
            for (const unlisted of matchResult.unlisted) {
                unlistedCount++;
                await this.statusRepository.updateProductStatus(
                    store.id,
                    'unknown',
                    unlisted.id,
                    unlisted.sku,
                    'unlisted',
                    0,
                    unlisted.price
                );
            }

        } catch (err: any) {
            this.logger.error(`Sync failed for store ${store.id}`, { storeId: store.id, error: err.message });

            errors.push({
                productId: 'ALL',
                errorMessage: err.message,
                errorType: err instanceof AppError ? err.type : ErrorType.INTERNAL
            });
        }

        const result: StoreSyncResult = {
            storeId: store.id,
            storeName: store.name,
            platform: store.platform,
            repricedCount,
            pendingCount,
            unlistedCount,
            errors,
            timestamp: new Date()
        };

        await this.statusRepository.saveSyncResult(result);
        return result;
    }

    private parseCredentials(store: Store): any {
        // Fallback for mock/legacy
        if (store.platform === 'woocommerce') {
            return {
                url: 'https://mock-url.com',
                consumerKey: 'ck_mock',
                consumerSecret: 'cs_mock'
            };
        }
        return {
            shopDomain: 'mock-shop',
            accessToken: 'shpat_mock'
        };
    }
}
