import type { Request, Response } from "express";
import {
	type ConfigRepository,
	createStoreConfig,
} from "../repositories/config";
import type { StatusRepository } from "../repositories/status";

export class StoreController {
	constructor(
		private configRepository: ConfigRepository,
		private statusRepository: StatusRepository,
	) {}

	getAllStores = async (_req: Request, res: Response) => {
		try {
			const configs = this.configRepository.getAllStoreConfigs();
			// Don't expose sensitive credentials in API response
			const stores = configs.map((config) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { credentials, ...rest } = config;
				return rest;
			});
			res.json(stores);
		} catch {
			res.status(500).json({ error: "Failed to fetch stores" });
		}
	};

	getStoreStatus = async (req: Request, res: Response) => {
		const { storeId } = req.params;
		try {
			const status = await this.statusRepository.getLatestSyncStatus(storeId);
			if (status) {
				res.json(status);
				return;
			}

			// If no status found, check if store exists
			const config = this.configRepository.getStoreConfig(storeId);
			if (!config) {
				res.status(404).json({ error: "Store not found" });
				return;
			}

			// Return default status for new stores
			res.json({
				storeId: config.storeId,
				storeName: config.storeName,
				platform: config.platform,
				repricedCount: 0,
				pendingCount: 0,
				unlistedCount: 0,
				errors: [],
				timestamp: new Date(),
			});
		} catch (error) {
			console.error("Failed to fetch store status:", error);
			res.status(500).json({ error: "Failed to fetch store status" });
		}
	};

	createStore = async (req: Request, res: Response): Promise<void> => {
		try {
			const config = req.body;

			// Basic validation
			if (
				!config.storeId ||
				!config.storeName ||
				!config.platform ||
				!config.credentials
			) {
				res.status(400).json({ error: "Missing required fields" });
				return;
			}

			// Create configuration with encrypted credentials
			const storeConfig = createStoreConfig(
				config.storeId,
				config.storeName,
				config.platform,
				config.credentials, // Raw credentials from request
				config.syncInterval || 60,
				config.enabled ?? true,
			);

			this.configRepository.saveStoreConfig(storeConfig);
			res.status(201).json({ message: "Store created successfully" });
		} catch (error) {
			console.error("Failed to create store:", error);
			res.status(500).json({ error: "Failed to create store" });
		}
	};

	getStoreProducts = async (req: Request, res: Response): Promise<void> => {
		try {
			const { storeId } = req.params;
			const products = await this.statusRepository.getStoreProducts(storeId);
			res.json(products);
		} catch (error) {
			console.error("Failed to get store products:", error);
			res.status(500).json({ error: "Failed to get store products" });
		}
	};
}
