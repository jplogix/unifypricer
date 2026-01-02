import { ShopifyClient } from "../clients/shopify";
import { StreetPricerClient } from "../clients/streetpricer";
import { WooCommerceClient } from "../clients/woocommerce";
import { config } from "../config/index.js";
import type { IAuditRepository } from "../repositories/audit";
import { AuditRepository } from "../repositories/audit";
import { AuditRepositoryPostgres } from "../repositories/audit-postgres.js";
import type { IConfigRepository } from "../repositories/config";
import { ConfigRepository } from "../repositories/config";
import { ConfigRepositoryPostgres } from "../repositories/config-postgres.js";
import type { IStatusRepository } from "../repositories/status";
import { StatusRepository } from "../repositories/status";
import { StatusRepositoryPostgres } from "../repositories/status-postgres.js";
import { ProductMatcher } from "../services/product-matcher";
import { SyncService } from "../services/sync-service";

// Singleton instances - use PostgreSQL or SQLite based on config
// Database connection must be initialized BEFORE this module is imported
export const configRepository: IConfigRepository =
	config.database.type === "postgres"
		? new ConfigRepositoryPostgres()
		: new ConfigRepository();

export const statusRepository: IStatusRepository =
	config.database.type === "postgres"
		? new StatusRepositoryPostgres()
		: new StatusRepository();

export const auditRepository: IAuditRepository =
	config.database.type === "postgres"
		? new AuditRepositoryPostgres()
		: new AuditRepository();

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
