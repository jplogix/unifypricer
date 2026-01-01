import type Database from "better-sqlite3";
import type { Platform, StoreConfig } from "../types";
import { decryptCredentials, encryptCredentials } from "../utils/encryption";
import { getDatabaseConnection } from "./database";

/**
 * Configuration Repository for managing store configurations
 * Handles CRUD operations for store configs with encrypted credentials
 */

export class ConfigRepository {
	constructor(private explicitDb?: Database.Database) {}

	private get db(): Database.Database {
		if (this.explicitDb) {
			return this.explicitDb;
		}
		const connection = getDatabaseConnection();
		return connection.getDatabase();
	}

	/**
	 * Get store configuration by ID
	 * @param storeId - The unique store identifier
	 * @returns Store configuration with decrypted credentials, or null if not found
	 */
	getStoreConfig(storeId: string): StoreConfig | null;
	async getStoreConfig(storeId: string): Promise<StoreConfig | null>;
	getStoreConfig(
		storeId: string,
	): StoreConfig | Promise<StoreConfig | null> | null {
		try {
			const query = this.db.prepare(`
        SELECT id, name, platform, credentials_encrypted, credentials_iv, 
               sync_interval, enabled
        FROM stores
        WHERE id = ?
      `);

			const row = query.get(storeId) as {
				id: string;
				name: string;
				platform: Platform;
				credentials_encrypted: string;
				credentials_iv: string;
				sync_interval: number;
				enabled: number;
			} | null;

			if (!row) {
				return null;
			}

			return this.mapRowToStoreConfig(row);
		} catch (error) {
			throw new Error(
				`Failed to get store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get all store configurations
	 * @returns Array of all store configurations with decrypted credentials
	 */
	getAllStoreConfigs(): StoreConfig[];
	async getAllStoreConfigs(): Promise<StoreConfig[]>;
	getAllStoreConfigs(): StoreConfig[] | Promise<StoreConfig[]> {
		try {
			const query = this.db.prepare(`
        SELECT id, name, platform, credentials_encrypted, credentials_iv, 
               sync_interval, enabled
        FROM stores
        ORDER BY name ASC
      `);

			const rows = query.all() as Array<{
				id: string;
				name: string;
				platform: Platform;
				credentials_encrypted: string;
				credentials_iv: string;
				sync_interval: number;
				enabled: number;
			}>;

			return rows.map((row) => this.mapRowToStoreConfig(row));
		} catch (error) {
			throw new Error(
				`Failed to get all store configs: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Save or update store configuration
	 * @param config - Store configuration to ;
	async saveStoreConfig(config: StoreConfig): Promise<void>;
	saveStoreConfig(config: StoreConfig): void | Promise<void>save
	 */
	saveStoreConfig(config: StoreConfig): void {
		try {
			// Check if store already exists
			const existing = this.getStoreConfig(config.storeId);

			if (existing) {
				// Update existing store
				this.updateStoreConfig(config);
			} else {
				// Insert new store
				this.insertStoreConfig(config);
			}
		} catch (error) {
			throw new Error(
				`Failed to save store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Delete store configuration
	 * @param storeId - The unique store ide;
	async deleteStoreConfig(storeId: string): Promise<void>;
	deleteStoreConfig(storeId: string): void | Promise<void>ntifier
	 */
	deleteStoreConfig(storeId: string): void {
		try {
			const query = this.db.prepare(`
        DELETE FROM stores
        WHERE id = ?
      `);

			query.run(storeId);
		} catch (error) {
			throw new Error(
				`Failed to delete store config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Insert new store configuration
	 * @private
	 */
	private insertStoreConfig(config: StoreConfig): void {
		const query = this.db.prepare(`
      INSERT INTO stores (
        id, name, platform, credentials_encrypted, credentials_iv,
        sync_interval, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

		query.run(
			config.storeId,
			config.storeName,
			config.platform,
			config.credentials.encrypted,
			config.credentials.iv,
			config.syncInterval,
			config.enabled ? 1 : 0,
		);
	}

	/**
	 * Update existing store configuration
	 * @private
	 */
	private updateStoreConfig(config: StoreConfig): void {
		const query = this.db.prepare(`
      UPDATE stores
      SET name = ?,
          platform = ?,
          credentials_encrypted = ?,
          credentials_iv = ?,
          sync_interval = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

		query.run(
			config.storeName,
			config.platform,
			config.credentials.encrypted,
			config.credentials.iv,
			config.syncInterval,
			config.enabled ? 1 : 0,
			config.storeId,
		);
	}

	/**
	 * Map database row to StoreConfig object
	 * @private
	 */
	private mapRowToStoreConfig(row: {
		id: string;
		name: string;
		platform: Platform;
		credentials_encrypted: string;
		credentials_iv: string;
		sync_interval: number;
		enabled: number;
	}): StoreConfig {
		return {
			storeId: row.id,
			storeName: row.name,
			platform: row.platform,
			credentials: {
				encrypted: row.credentials_encrypted,
				iv: row.credentials_iv,
			},
			syncInterval: row.sync_interval,
			enabled: row.enabled === 1,
		};
	}
}

/**
 * Helper function to create StoreConfig with encrypted credentials
 * @param storeId - Unique store identifier
 * @param storeName - Display name for the store
 * @param platform - E-commerce platform type
 * @param credentials - Plain credentials object to encrypt
 * @param syncInterval - Sync interval in minutes (default: 60)
 * @param enabled - Whether the store is enabled (default: true)
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns StoreConfig with encrypted credentials
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

/**
 * Helper function to decrypt credentials from StoreConfig
 * @param config - Store configuration with encrypted credentials
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns Decrypted credentials object
 */
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
