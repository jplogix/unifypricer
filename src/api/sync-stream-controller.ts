import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import {
	type ConfigRepository,
	getDecryptedCredentials,
} from "../repositories/config";
import type { SyncService } from "../services/sync-service";
import type { Store } from "../types";

// Global event emitter for sync events
export const syncEventEmitter = new EventEmitter();

export class SyncStreamController {
	constructor(
		private syncService: SyncService,
		private configRepository: ConfigRepository,
	) {}

	streamSync = async (req: Request, res: Response) => {
		const { storeId } = req.params;

		try {
			const config = this.configRepository.getStoreConfig(storeId);
			if (!config) {
				res.status(404).json({ error: "Store not found" });
				return;
			}

			// Set up SSE headers
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
			res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

			// Send initial connection message
			res.write(
				`data: ${JSON.stringify({ type: "connected", message: "Stream connected" })}\n\n`,
			);

			const credentials = getDecryptedCredentials(config);

			const store: Store = {
				id: config.storeId,
				name: config.storeName,
				platform: config.platform,
				syncInterval: config.syncInterval,
				enabled: config.enabled,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Listen for sync events for this store
			const eventListener = (event: {
				storeId: string;
				type: string;
				message: string;
				data?: unknown;
			}) => {
				if (event.storeId === storeId) {
					res.write(`data: ${JSON.stringify(event)}\n\n`);
				}
			};

			syncEventEmitter.on("sync-event", eventListener);

			// Clean up on client disconnect
			req.on("close", () => {
				syncEventEmitter.off("sync-event", eventListener);
			});

			// Start sync in background
			(async () => {
				try {
					await this.syncService.syncStore(store, credentials);
					res.write(
						`data: ${JSON.stringify({ storeId, type: "complete", message: "Sync completed successfully" })}\n\n`,
					);
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : String(err);
					res.write(
						`data: ${JSON.stringify({ storeId, type: "error", message: `Sync failed: ${errorMessage}` })}\n\n`,
					);
				} finally {
					syncEventEmitter.off("sync-event", eventListener);
					res.end();
				}
			})();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			res
				.status(500)
				.json({ error: `Failed to start sync stream: ${errorMessage}` });
		}
	};
}
