import type Database from "better-sqlite3";
import type {
	ProductStatusRecord,
	ProductSyncStatus,
	StoreSyncResult,
	SyncError,
	SyncHistoryRecord,
	SyncStatus,
} from "../types/index.js";
import { getDatabaseConnection } from "./database.js";

const normalizePrice = (value: unknown): number | undefined => {
	if (value === null || value === undefined) {
		return undefined;
	}
	const num = typeof value === "number" ? value : Number(value);
	return Number.isFinite(num) ? num : undefined;
};

/**
 * Interface for status repository - enables both SQLite and PostgreSQL implementations
 */
export interface IStatusRepository {
	saveSyncResult(result: StoreSyncResult): Promise<void>;
	getLatestSyncStatus(storeId: string): Promise<StoreSyncResult | null>;
	startSync(storeId: string, startedAt?: Date): Promise<void>;
	updateSyncProgress(
		storeId: string,
		repricedCount: number,
		pendingCount: number,
		unlistedCount: number,
		errorMessage?: string,
	): Promise<void>;
	getSyncHistory(storeId: string, limit?: number): Promise<SyncHistoryRecord[]>;
	updateProductStatus(
		storeId: string,
		platformProductId: string,
		streetpricerProductId: string,
		sku: string,
		status: ProductSyncStatus,
		currentPrice: number,
		targetPrice: number,
		errorMessage?: string,
	): Promise<void>;
	getProductStatus(
		storeId: string,
		status?: ProductSyncStatus,
	): Promise<ProductStatusRecord[]>;
	getProductStatusCounts(storeId: string): Promise<{
		repriced: number;
		pending: number;
		unlisted: number;
	}>;
	getStoreProducts(storeId: string): Promise<ProductStatusRecord[]>;
	clearOldProductStatus(
		storeId: string,
		olderThanDays?: number,
	): Promise<number>;
}

/**
 * Repository for managing sync status and product status data (SQLite)
 */
export class StatusRepository implements IStatusRepository {
	constructor(private dbPath?: string) {}

	private getDb(): Database.Database {
		const connection = getDatabaseConnection(this.dbPath);
		return connection.getDatabase();
	}

	/**
	 * Save sync result to database
	 */
	async saveSyncResult(result: StoreSyncResult): Promise<void> {
		try {
			const db = this.getDb();

			// Determine overall status based on errors
			let status: SyncStatus = "success";
			let errorMessage: string | null = null;

			if (result.errors.length > 0) {
				status =
					result.errors.length === result.repricedCount + result.pendingCount
						? "failed"
						: "partial";
				errorMessage = JSON.stringify(result.errors);
			}

			// Try to update an existing in-progress row first
			const updateStmt = db.prepare(`
        UPDATE sync_history
        SET repriced_count = ?, pending_count = ?, unlisted_count = ?, status = ?, error_message = ?, completed_at = ?
        WHERE store_id = ? AND status = 'in_progress'
      `);

			const resultInfo: Database.RunResult = updateStmt.run(
				result.repricedCount,
				result.pendingCount,
				result.unlistedCount,
				status,
				errorMessage,
				result.timestamp.toISOString(),
				result.storeId,
			);

			if ((resultInfo as { changes: number }).changes === 0) {
				// No in-progress row to update, insert a new completed row
				const insertStmt = db.prepare(`
          INSERT INTO sync_history (
            store_id, repriced_count, pending_count, unlisted_count,
            status, error_message, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

				insertStmt.run(
					result.storeId,
					result.repricedCount,
					result.pendingCount,
					result.unlistedCount,
					status,
					errorMessage,
					result.timestamp.toISOString(),
					result.timestamp.toISOString(),
				);
			}
		} catch (error) {
			throw new Error(
				`Failed to save sync result: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get the latest sync status for a store
	 */
	async getLatestSyncStatus(storeId: string): Promise<StoreSyncResult | null> {
		try {
			const stmt = this.getDb().prepare(`
        SELECT 
          sh.store_id,
          s.name as store_name,
          s.platform,
          sh.repriced_count,
          sh.pending_count,
          sh.unlisted_count,
          sh.status,
          sh.error_message,
          sh.started_at,
          sh.completed_at
        FROM sync_history sh
        JOIN stores s ON sh.store_id = s.id
        WHERE sh.store_id = ?
        ORDER BY COALESCE(sh.completed_at, sh.started_at) DESC
        LIMIT 1
      `);

			const row = stmt.get(storeId) as {
				store_id: string;
				store_name: string;
				platform: string;
				repriced_count: number;
				pending_count: number;
				unlisted_count: number;
				status: string;
				error_message: string | null;
				started_at: string;
				completed_at: string | null;
			} | null;

			if (!row) {
				return null;
			}

			let errors: SyncError[] = [];

			if (row.error_message) {
				try {
					const parsed = JSON.parse(row.error_message);
					if (Array.isArray(parsed)) {
						errors = parsed
							.filter(
								(error: unknown): error is SyncError =>
									typeof (error as SyncError)?.productId === "string" &&
									typeof (error as SyncError)?.errorMessage === "string" &&
									typeof (error as SyncError)?.errorType === "string",
							)
							.map((error) => ({
								productId: error.productId,
								errorMessage: error.errorMessage,
								errorType: error.errorType,
							}));
					}
				} catch {
					errors = row.error_message.split("; ").map((errorStr: string) => {
						const [productId, ...messageParts] = errorStr.split(": ");
						return {
							productId,
							errorMessage: messageParts.join(": "),
							errorType: "unknown_error" as SyncError["errorType"],
						};
					});
				}
			}

			return {
				storeId: row.store_id,
				storeName: row.store_name,
				platform: row.platform as "shopify" | "woocommerce",
				repricedCount: row.repriced_count,
				pendingCount: row.pending_count,
				unlistedCount: row.unlisted_count,
				errors,
				timestamp: new Date(row.completed_at || row.started_at),
				status: row.status as SyncStatus,
			};
		} catch (error) {
			throw new Error(
				`Failed to get latest sync status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Start a new sync entry (in_progress). This allows the UI to poll for live progress.
	 */
	async startSync(
		storeId: string,
		startedAt: Date = new Date(),
	): Promise<void> {
		try {
			const stmt = this.getDb().prepare(`
				INSERT INTO sync_history (
				  store_id, repriced_count, pending_count, unlisted_count,
				  status, error_message, started_at, completed_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`);

			stmt.run(
				storeId,
				0,
				0,
				0,
				"in_progress",
				null,
				startedAt.toISOString(),
				null,
			);
		} catch (error) {
			throw new Error(
				`Failed to start sync: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Update progress for the currently running sync entry
	 */
	async updateSyncProgress(
		storeId: string,
		repricedCount: number,
		pendingCount: number,
		unlistedCount: number,
		errorMessage?: string,
	): Promise<void> {
		try {
			const stmt = this.getDb().prepare(`
				UPDATE sync_history
				SET repriced_count = ?, pending_count = ?, unlisted_count = ?, error_message = ?
				WHERE store_id = ? AND status = 'in_progress' AND started_at = (
				  SELECT MAX(started_at) FROM sync_history WHERE store_id = ? AND status = 'in_progress'
				)
			`);

			stmt.run(
				repricedCount,
				pendingCount,
				unlistedCount,
				errorMessage || null,
				storeId,
				storeId,
			);
		} catch (error) {
			throw new Error(
				`Failed to update sync progress: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get sync history for a store with optional limit
	 */
	async getSyncHistory(
		storeId: string,
		limit: number = 10,
	): Promise<SyncHistoryRecord[]> {
		try {
			const stmt = this.getDb().prepare(`
        SELECT 
          id, store_id, repriced_count, pending_count, unlisted_count,
          status, error_message, started_at, completed_at
        FROM sync_history
        WHERE store_id = ?
        ORDER BY completed_at DESC
        LIMIT ?
      `);

			type SyncHistoryRow = {
				id: number;
				store_id: string;
				repriced_count: number;
				pending_count: number;
				unlisted_count: number;
				status: SyncStatus;
				error_message: string | null;
				started_at: string;
				completed_at: string | null;
			};

			const rows = stmt.all(storeId, limit) as SyncHistoryRow[];

			return rows.map((row) => ({
				id: row.id,
				storeId: row.store_id,
				repricedCount: row.repriced_count,
				pendingCount: row.pending_count,
				unlistedCount: row.unlisted_count,
				status: row.status,
				errorMessage: row.error_message ?? undefined,
				startedAt: new Date(row.started_at),
				completedAt: row.completed_at
					? new Date(row.completed_at)
					: new Date(row.started_at),
			}));
		} catch (error) {
			throw new Error(
				`Failed to get sync history: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Update product status for tracking repriced, pending, and unlisted products
	 */
	async updateProductStatus(
		storeId: string,
		platformProductId: string,
		streetpricerProductId: string,
		sku: string,
		status: ProductSyncStatus,
		currentPrice: number,
		targetPrice: number,
		errorMessage?: string,
	): Promise<void> {
		try {
			const now = new Date().toISOString();
			const lastSuccess = status === "repriced" ? now : null;

			const stmt = this.getDb().prepare(`
        INSERT OR REPLACE INTO product_status (
          store_id, platform_product_id, streetpricer_product_id, sku,
          status, last_attempt, last_success, error_message,
          current_price, target_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

			stmt.run(
				storeId,
				platformProductId,
				streetpricerProductId,
				sku,
				status,
				now,
				lastSuccess,
				errorMessage || null,
				currentPrice,
				targetPrice,
			);
		} catch (error) {
			throw new Error(
				`Failed to update product status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get product status records for a store, optionally filtered by status
	 */
	async getProductStatus(
		storeId: string,
		status?: ProductSyncStatus,
	): Promise<ProductStatusRecord[]> {
		try {
			let query = `
        SELECT 
          id, store_id, platform_product_id, streetpricer_product_id, sku,
          status, last_attempt, last_success, error_message,
          current_price, target_price
        FROM product_status
        WHERE store_id = ?
      `;

			const params: unknown[] = [storeId];

			if (status) {
				query += " AND status = ?";
				params.push(status);
			}

			query += " ORDER BY last_attempt DESC";

			const stmt = this.getDb().prepare(query);
			type ProductStatusRow = {
				id: number;
				store_id: string;
				platform_product_id: string;
				streetpricer_product_id: string;
				sku: string;
				status: ProductSyncStatus;
				last_attempt: string;
				last_success: string | null;
				error_message: string | null;
				current_price: number;
				target_price: number;
			};

			const rows = stmt.all(...params) as ProductStatusRow[];

			return rows.map((row) => ({
				id: row.id,
				storeId: row.store_id,
				platformProductId: row.platform_product_id,
				streetpricerProductId: row.streetpricer_product_id,
				sku: row.sku,
				status: row.status,
				lastAttempt: new Date(row.last_attempt),
				lastSuccess: row.last_success ? new Date(row.last_success) : undefined,
				errorMessage: row.error_message ?? undefined,
				currentPrice: normalizePrice(row.current_price),
				targetPrice: normalizePrice(row.target_price),
			}));
		} catch (error) {
			throw new Error(
				`Failed to get product status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get product status counts for a store (for dashboard display)
	 */
	async getProductStatusCounts(storeId: string): Promise<{
		repriced: number;
		pending: number;
		unlisted: number;
	}> {
		try {
			const db = this.getDb();

			const repriced = db
				.prepare(
					"SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?",
				)
				.get(storeId, "repriced") as { count: number } | null;
			const pending = db
				.prepare(
					"SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?",
				)
				.get(storeId, "pending") as { count: number } | null;
			const unlisted = db
				.prepare(
					"SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?",
				)
				.get(storeId, "unlisted") as { count: number } | null;

			return {
				repriced: repriced?.count || 0,
				pending: pending?.count || 0,
				unlisted: unlisted?.count || 0,
			};
		} catch (error) {
			throw new Error(
				`Failed to get product status counts: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get all products for a store
	 */
	async getStoreProducts(storeId: string): Promise<ProductStatusRecord[]> {
		return this.getProductStatus(storeId);
	}

	/**
	 * Clear old product status records (cleanup utility)
	 */
	async clearOldProductStatus(
		storeId: string,
		olderThanDays: number = 30,
	): Promise<number> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

			const stmt = this.getDb().prepare(`
        DELETE FROM product_status
        WHERE store_id = ? AND last_attempt < ?
      `);

			const result = stmt.run(storeId, cutoffDate.toISOString());
			return result.changes;
		} catch (error) {
			throw new Error(
				`Failed to clear old product status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
