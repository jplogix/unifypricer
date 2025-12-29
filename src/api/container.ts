import { ConfigRepository } from '../repositories/config';
import { StatusRepository } from '../repositories/status';
import { AuditRepository } from '../repositories/audit';
import { SyncService } from '../services/sync-service';
import { StreetPricerClient } from '../clients/streetpricer';
import { ProductMatcher } from '../services/product-matcher';
import { WooCommerceClient } from '../clients/woocommerce';
import { ShopifyClient } from '../clients/shopify';

// Singleton instances
export const configRepository = new ConfigRepository();
export const statusRepository = new StatusRepository();
export const auditRepository = new AuditRepository();

// Service dependencies
const streetPricerClient = new StreetPricerClient();
const productMatcher = new ProductMatcher();

const platformClients = {
    woocommerce: (_creds: any) => new WooCommerceClient(),
    shopify: (_creds: any) => new ShopifyClient()
};

export const syncService = new SyncService(
    streetPricerClient,
    productMatcher,
    statusRepository,
    auditRepository,
    platformClients
);
