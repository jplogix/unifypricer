import { ShopifyClient } from "../clients/shopify";
import { StreetPricerClient } from "../clients/streetpricer";
import { WooCommerceClient } from "../clients/woocommerce";
import { AuditRepository } from "../repositories/audit";
import { ConfigRepository } from "../repositories/config";
import { StatusRepository } from "../repositories/status";
import { ProductMatcher } from "../services/product-matcher";
import { SyncService } from "../services/sync-service";

// Singleton instances
export const configRepository = new ConfigRepository();
export const statusRepository = new StatusRepository();
export const auditRepository = new AuditRepository();

// Service dependencies
const streetPricerClient = new StreetPricerClient();
const productMatcher = new ProductMatcher();

const platformClients = {
	woocommerce: () => new WooCommerceClient(),
	shopify: () => new ShopifyClient(),
};

export const syncService = new SyncService(
	streetPricerClient,
	productMatcher,
	statusRepository,
	auditRepository,
	platformClients,
);
