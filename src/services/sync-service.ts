import { syncEventEmitter } from "../api/sync-stream-controller.js";
import type { IShopifyClient } from "../clients/shopify.js";
import type { IStreetPricerClient } from "../clients/streetpricer.js";
import type { IWooCommerceClient } from "../clients/woocommerce.js";
import type { IAuditRepository } from "../repositories/audit.js";
import type { IStatusRepository } from "../repositories/status.js";
import type {
	ShopifyVariant,
	Store,
	StoreSyncResult,
	SyncError,
	WooCommerceProduct,
} from "../types/index.js";
import { AppError, ErrorType } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";
import type { IProductMatcher } from "./product-matcher.js";

export interface ISyncService {
	syncStore(
		store: Store,
		credentials?: Record<string, unknown>,
	): Promise<StoreSyncResult>;
}

export class SyncService implements ISyncService {
	private logger = new Logger("SyncService");

	constructor(
		private streetPricerClient: IStreetPricerClient,
		private productMatcher: IProductMatcher,
		private statusRepository: IStatusRepository,
		private auditRepository: IAuditRepository,
		private platformClients: {
			woocommerce: (creds: Record<string, unknown>) => IWooCommerceClient;
			shopify: (creds: Record<string, unknown>) => IShopifyClient;
		},
	) {}

	private emitEvent(
		storeId: string,
		type: string,
		message: string,
		data?: unknown,
	) {
		syncEventEmitter.emit("sync-event", { storeId, type, message, data });
	}

	async syncStore(
		store: Store,
		credentials?: Record<string, unknown>,
	): Promise<StoreSyncResult> {
		this.logger.info(`Starting sync for store ${store.id}`, {
			storeId: store.id,
		});
		this.emitEvent(store.id, "info", `Starting sync for store ${store.name}`);

		const errors: SyncError[] = [];
		let repricedCount = 0;
		let pendingCount = 0;
		let unlistedCount = 0;

		try {
			// Mark sync as started (so UI can poll for in-progress updates)
			await this.statusRepository.startSync(store.id);
			this.emitEvent(store.id, "info", "Marked sync as in progress");

			// 1. Fetch StreetPricer Data
			this.emitEvent(
				store.id,
				"info",
				"Fetching products from StreetPricer...",
			);
			const spProducts = await this.streetPricerClient.fetchAllProducts();
			this.emitEvent(
				store.id,
				"success",
				`Fetched ${spProducts.length} products from StreetPricer`,
			);

			// 2. Fetch Platform Data
			this.emitEvent(
				store.id,
				"info",
				`Connecting to ${store.platform} store...`,
			);
			let platformProducts: (WooCommerceProduct | ShopifyVariant)[] = [];
			let platformClient: IWooCommerceClient | IShopifyClient;

			const authCredentials = credentials || this.parseCredentials(store);

			if (store.platform === "woocommerce") {
				const client = this.platformClients.woocommerce(authCredentials);
				this.emitEvent(store.id, "info", "Authenticating with WooCommerce...");
				await client.authenticate(
					String(authCredentials.url),
					String(authCredentials.consumerKey),
					String(authCredentials.consumerSecret),
				);
				this.emitEvent(
					store.id,
					"success",
					"WooCommerce authentication successful",
				);
				this.emitEvent(
					store.id,
					"info",
					"Fetching products from WooCommerce...",
				);
				platformProducts = await client.getAllProducts();
				this.emitEvent(
					store.id,
					"success",
					`Fetched ${platformProducts.length} products from WooCommerce`,
				);
				platformClient = client;
			} else if (store.platform === "shopify") {
				const client = this.platformClients.shopify(authCredentials);
				this.emitEvent(store.id, "info", "Authenticating with Shopify...");
				await client.authenticate(
					String(authCredentials.shopDomain),
					String(authCredentials.accessToken),
				);
				this.emitEvent(
					store.id,
					"success",
					"Shopify authentication successful",
				);
				this.emitEvent(store.id, "info", "Fetching products from Shopify...");
				const shopsProducts = await client.getAllProducts();
				platformProducts = shopsProducts.flatMap((p) => p.variants);
				this.emitEvent(
					store.id,
					"success",
					`Fetched ${platformProducts.length} variants from Shopify`,
				);
				platformClient = client;
			} else {
				throw new AppError(
					`Unsupported platform: ${store.platform}`,
					ErrorType.CONFIGURATION,
				);
			}

			// 3. Match Products
			this.emitEvent(
				store.id,
				"info",
				"Matching products between StreetPricer and platform...",
			);
			const matchResult = this.productMatcher.matchProducts(
				spProducts,
				platformProducts,
			);
			this.emitEvent(
				store.id,
				"success",
				`Matched ${matchResult.matched.length} products, ${matchResult.unlisted.length} unlisted`,
			);

			// 4. Process Matches
			this.emitEvent(store.id, "info", "Processing price updates...");
			for (const match of matchResult.matched) {
				const sp = match.streetPricerProduct;
				const pp = match.platformProduct;

				const currentPrice = parseFloat(pp.price);
				const targetPrice = sp.price;

				// Simple repricing logic: if diff > 0.01
				if (Math.abs(currentPrice - targetPrice) > 0.01) {
					try {
						if (store.platform === "woocommerce") {
							await (platformClient as IWooCommerceClient).updateProductPrice(
								pp.id,
								targetPrice,
							);
						} else {
							// For Shopify, use the productId from the variant
							const shopifyVariant = pp as ShopifyVariant;
							await (platformClient as IShopifyClient).updateProductPrice(
								shopifyVariant.productId,
								shopifyVariant.id,
								targetPrice,
							);
						}

						repricedCount++;
						this.emitEvent(
							store.id,
							"success",
							`Updated price for ${pp.sku || pp.id}: $${currentPrice.toFixed(2)} → $${targetPrice.toFixed(2)}`,
						);
						await this.statusRepository.updateSyncProgress(
							store.id,
							repricedCount,
							pendingCount,
							unlistedCount,
						);

						// Status Update
						await this.statusRepository.updateProductStatus(
							store.id,
							String(pp.id),
							sp.id,
							sp.sku,
							"repriced",
							currentPrice,
							targetPrice,
						);

						// Audit Log
						await this.auditRepository.log({
							storeId: store.id,
							productId: String(pp.id),
							action: "PRICE_UPDATE",
							oldValue: String(currentPrice),
							newValue: String(targetPrice),
							details: `Updated from ${currentPrice} to ${targetPrice} based on StreetPricer ${sp.id}`,
						});

						this.logger.info(`Repriced product ${pp.id}`, {
							storeId: store.id,
							productId: pp.id,
							oldPrice: currentPrice,
							newPrice: targetPrice,
						});
					} catch (err: unknown) {
						pendingCount++;
						// Update progress so UI shows pending increases
						await this.statusRepository.updateSyncProgress(
							store.id,
							repricedCount,
							pendingCount,
							unlistedCount,
						);
						const errMsg = err instanceof Error ? err.message : String(err);
						const errorType =
							err instanceof AppError ? err.type : ErrorType.NETWORK;

						errors.push({
							productId: String(pp.id),
							errorMessage: errMsg,
							errorType: errorType,
						});

						this.logger.error(`Failed to update product ${pp.id}`, {
							storeId: store.id,
							productId: pp.id,
							error: errMsg,
						});

						await this.statusRepository.updateProductStatus(
							store.id,
							String(pp.id),
							sp.id,
							sp.sku,
							"pending",
							currentPrice,
							targetPrice,
							errMsg,
						);
					}
				}
			}

			// 5. Process Unlisted
			for (const unlisted of matchResult.unlisted) {
				unlistedCount++;
				await this.statusRepository.updateProductStatus(
					store.id,
					"unknown",
					unlisted.id,
					unlisted.sku,
					"unlisted",
					0,
					unlisted.price,
				);
				// Update progress so UI can reflect unlisted count
				await this.statusRepository.updateSyncProgress(
					store.id,
					repricedCount,
					pendingCount,
					unlistedCount,
				);
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.logger.error(`Sync failed for store ${store.id}`, {
				storeId: store.id,
				error: errMsg,
			});

			// Update in-progress sync row with error so UI can show failure immediately
			await this.statusRepository.updateSyncProgress(
				store.id,
				repricedCount,
				pendingCount,
				unlistedCount,
				errMsg,
			);

			errors.push({
				productId: "ALL",
				errorMessage: errMsg,
				errorType: err instanceof AppError ? err.type : ErrorType.INTERNAL,
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
			timestamp: new Date(),
		};

		await this.statusRepository.saveSyncResult(result);
		return result;
	}

	private parseCredentials(store: Store): Record<string, unknown> {
		// Fallback for mock/legacy
		if (store.platform === "woocommerce") {
			return {
				url: "https://mock-url.com",
				consumerKey: "ck_mock",
				consumerSecret: "cs_mock",
			};
		}
		return {
			shopDomain: "mock-shop",
			accessToken: "shpat_mock",
		};
	}
}
