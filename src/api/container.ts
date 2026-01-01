import { ShopifyClient } from "../clients/shopify";
import { StreetPricerClient } from "../clients/streetpricer";
import { WooCommerceClient } from "../clients/woocommerce";
import { config } from "../config/index.js";
import { AuditRepository } from "../repositories/audit";
import type { IConfigRepository } from "../repositories/config";
import { ConfigRepository } from "../repositories/config";
import { ConfigRepositoryPostgres } from "../repositories/config-postgres.js";
import { StatusRepository } from "../repositories/status";
import { ProductMatcher } from "../services/product-matcher";
import { SyncService } from "../services/sync-service";

// Singleton instances - use PostgreSQL or SQLite based on config
export const configRepository: IConfigRepository =
	config.database.type === "postgres"
		? new ConfigRepositoryPostgres()
		: new ConfigRepository();

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
