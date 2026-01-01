import type { IConfigRepository } from "../repositories/config";
import { getDecryptedCredentials } from "../repositories/config";
import type { StatusRepository } from "../repositories/status";
import type { Store } from "../types";
import { Logger } from "../utils/logger";
import type { SyncService } from "./sync-service";

export class SchedulerService {
	private timer: ReturnType<typeof setInterval> | null = null;
	private isRunning: boolean = false;
	private logger = new Logger("Scheduler");
	private runningSyncs = new Set<string>();

	constructor(
		private configRepository: IConfigRepository,
		private statusRepository: StatusRepository,
		private syncService: SyncService,
	) {}

	start(intervalMs: number = 60000) {
		if (this.isRunning) return;
		this.isRunning = true;
		this.logger.info("Starting scheduler...");
		// Run immediately
		this.checkAndSchedule();
		// Then schedule
		this.timer = setInterval(() => this.checkAndSchedule(), intervalMs);
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.isRunning = false;
		this.logger.info("Scheduler stopped.");
	}

	private async checkAndSchedule() {
		try {
			const stores = await this.configRepository.getAllStoreConfigs();

			for (const config of stores) {
				if (!config.enabled) continue;

				// Concurrency check: Ensure only one sync runs per store
				if (this.runningSyncs.has(config.storeId)) {
					this.logger.debug(
						`Skipping sync for store ${config.storeId}: Sync already in progress.`,
					);
					continue;
				}

				try {
					const lastSync = await this.statusRepository.getLatestSyncStatus(
						config.storeId,
					);
					const lastSyncTime = lastSync
						? new Date(lastSync.timestamp)
						: new Date(0);

					// syncInterval is in minutes. Calculate next run time.
					const nextSyncTime = new Date(
						lastSyncTime.getTime() + config.syncInterval * 60 * 1000,
					);

					if (new Date() >= nextSyncTime) {
						this.logger.info(
							`Triggering sync for store ${config.storeId} (${config.storeName})`,
						);
						this.runningSyncs.add(config.storeId);

						const store: Store = {
							id: config.storeId,
							name: config.storeName,
							platform: config.platform,
							syncInterval: config.syncInterval,
							enabled: config.enabled,
							createdAt: new Date(),
							updatedAt: new Date(),
						};

						const credentials = getDecryptedCredentials(config);

						// Fire and forget, but handle rejection
						this.syncService
							.syncStore(store, credentials)
							.then(() => {
								this.logger.info(`Sync completed for store ${config.storeId}`);
							})
							.catch((err) => {
								this.logger.error(`Sync failed for store ${config.storeId}:`, {
									error: err,
								});
							})
							.finally(() => {
								this.runningSyncs.delete(config.storeId);
							});
					}
				} catch (error) {
					this.logger.error(
						`Failed to check status for store ${config.storeId}:`,
						{ error },
					);
				}
			}
		} catch (error) {
			this.logger.error("Critical error in check loop:", { error });
		}
	}
}
