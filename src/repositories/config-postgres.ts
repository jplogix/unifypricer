import type { Pool } from "pg";
import type { Platform, StoreConfig } from "../types/index.js";
import { decryptCredentials, encryptCredentials } from "../utils/encryption.js";
import { getPostgresConnection } from "./postgres-database.js";

/**
 * Configuration Repository for PostgreSQL
 */
export class ConfigRepositoryPostgres {
	constructor(private explicitPool?: Pool) {}

	private get pool(): Pool {
		if (this.explicitPool) {
			return this.explicitPool;
		}
		const connection = getPostgresConnection();
		return connection.getPool();
	}

	/**
	 * Get store configuration by ID
	 */
	async getStoreConfig(storeId: string): Promise<StoreConfig | null> {
		try {
			const result = await this.pool.query(
				`SELECT id, name, platform, credentials_encrypted, credentials_iv, 
                sync_interval, enabled
         FROM stores
         WHERE id = $1`,
				[storeId],
			);

			if (result.rows.length === 0) {
				return null;
			}

			return this.mapRowToStoreConfig(result.rows[0]);
		} catch (error) {
			throw new Error(
				`Failed to get store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get all store configurations
	 */
	async getAllStoreConfigs(): Promise<StoreConfig[]> {
		try {
			const result = await this.pool.query(
				`SELECT id, name, platform, credentials_encrypted, credentials_iv, 
                sync_interval, enabled
         FROM stores
         ORDER BY name ASC`,
			);

			return result.rows.map((row) => this.mapRowToStoreConfig(row));
		} catch (error) {
			throw new Error(
				`Failed to get all store configs: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Save or update store configuration
	 */
	async saveStoreConfig(config: StoreConfig): Promise<void> {
		try {
			// Check if store already exists
			const existing = await this.getStoreConfig(config.storeId);

			if (existing) {
				await this.updateStoreConfig(config);
			} else {
				await this.insertStoreConfig(config);
			}
		} catch (error) {
			throw new Error(
				`Failed to save store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Delete store configuration
	 */
	async deleteStoreConfig(storeId: string): Promise<void> {
		try {
			await this.pool.query("DELETE FROM stores WHERE id = $1", [storeId]);
		} catch (error) {
			throw new Error(
				`Failed to delete store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Insert new store configuration
	 */
	private async insertStoreConfig(config: StoreConfig): Promise<void> {
		await this.pool.query(
			`INSERT INTO stores (
        id, name, platform, credentials_encrypted, credentials_iv,
        sync_interval, enabled, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			[
				config.storeId,
				config.storeName,
				config.platform,
				config.credentials.encrypted,
				config.credentials.iv,
				config.syncInterval,
				config.enabled,
			],
		);
	}

	/**
	 * Update existing store configuration
	 */
	private async updateStoreConfig(config: StoreConfig): Promise<void> {
		await this.pool.query(
			`UPDATE stores
       SET name = $1,
           platform = $2,
           credentials_encrypted = $3,
           credentials_iv = $4,
           sync_interval = $5,
           enabled = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
			[
				config.storeName,
				config.platform,
				config.credentials.encrypted,
				config.credentials.iv,
				config.syncInterval,
				config.enabled,
				config.storeId,
			],
		);
	}

	/**
	 * Map database row to StoreConfig object
	 */
	private mapRowToStoreConfig(row: {
		id: string;
		name: string;
		platform: Platform;
		credentials_encrypted: string;
		credentials_iv: string;
		sync_interval: number;
		enabled: boolean;
	}): StoreConfig {
		return {
			storeId: row.id,
			storeName: row.name,
			platform: row.platform as Platform,
			credentials: {
				encrypted: row.credentials_encrypted,
				iv: row.credentials_iv,
			},
			syncInterval: row.sync_interval,
			enabled: row.enabled,
		};
	}
}

/**
 * Helper functions (same as before)
 */
export function createStoreConfig(
	storeId: string,
	storeName: string,
	platform: Platform,
	credentials: Record<string, string>,
	syncInterval: number = 60,
	enabled: boolean = true,
	encryptionKey?: string,
): StoreConfig {
	const encryptedCreds = encryptCredentials(credentials, encryptionKey);

	return {
		storeId,
		storeName,
		platform,
		credentials: encryptedCreds,
		syncInterval,
		enabled,
	};
}

export function getDecryptedCredentials(
	config: StoreConfig,
	encryptionKey?: string,
): Record<string, string> {
	return decryptCredentials(
		config.credentials.encrypted,
		config.credentials.iv,
		encryptionKey,
	);
}
