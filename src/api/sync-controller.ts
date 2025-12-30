import { Request, Response } from 'express';
import { SyncService } from '../services/sync-service';
import { ConfigRepository, getDecryptedCredentials } from '../repositories/config';
import { Store } from '../types';

export class SyncController {
    constructor(
        private syncService: SyncService,
        private configRepository: ConfigRepository
    ) { }

    triggerSync = async (req: Request, res: Response) => {
        const { storeId } = req.params;
        try {
            const config = this.configRepository.getStoreConfig(storeId);
            if (!config) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }

            const credentials = getDecryptedCredentials(config);

            const store: Store = {
                id: config.storeId,
                name: config.storeName,
                platform: config.platform,
                syncInterval: config.syncInterval,
                enabled: config.enabled,
                createdAt: new Date(), // Mock dates as they aren't in StoreConfig
                updatedAt: new Date()
            };

            const result = await this.syncService.syncStore(store, credentials);
            res.json(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.status(500).json({ error: `Sync failed: ${errorMessage}` });
        }
    };
}
