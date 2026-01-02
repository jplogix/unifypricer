import type {
	ProductStatusRecord,
	ProductSyncStatus,
	StoreSyncResult,
	SyncError,
	SyncHistoryRecord,
	SyncStatus,
} from "../types/index.js";
import { getPostgresConnection } from "./postgres-database.js";
import type { IStatusRepository } from "./status.js";

const normalizePrice = (value: unknown): number | undefined => {
	if (value === null || value === undefined) {
		return undefined;
	}
	const num = typeof value === "number" ? value : Number(value);
	return Number.isFinite(num) ? num : undefined;
};

/**
 * PostgreSQL Repository for managing sync status and product status data
 */
export class StatusRepositoryPostgres implements IStatusRepository {
	/**
	 * Save sync result to database
	 */
	async saveSyncResult(result: StoreSyncResult): Promise<void> {
		try {
			const db = getPostgresConnection();

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
			const updateResult = await db.query(
				`UPDATE sync_history
        SET repriced_count = $1, pending_count = $2, unlisted_count = $3, 
            status = $4, error_message = $5, completed_at = $6
        WHERE store_id = $7 AND status = 'in_progress'`,
				[
					result.repricedCount,
					result.pendingCount,
					result.unlistedCount,
					status,
					errorMessage,
					result.timestamp.toISOString(),
					result.storeId,
				],
			);

			if (updateResult.rowCount === 0) {
				// No in-progress row to update, insert a new completed row
				await db.query(
					`INSERT INTO sync_history (
            store_id, repriced_count, pending_count, unlisted_count,
            status, error_message, started_at, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
					[
						result.storeId,
						result.repricedCount,
						result.pendingCount,
						result.unlistedCount,
						status,
						errorMessage,
						result.timestamp.toISOString(),
						result.timestamp.toISOString(),
					],
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
			const db = getPostgresConnection();

			const result = await db.query(
				`SELECT 
          sh.store_id,
          s.name as store_name,
          s.platform as platform,
          sh.repriced_count,
          sh.pending_count,
          sh.unlisted_count,
          sh.status,
          sh.error_message,
          sh.started_at,
          sh.completed_at
        FROM sync_history sh
        JOIN stores s ON sh.store_id = s.id
        WHERE sh.store_id = $1
        ORDER BY COALESCE(sh.completed_at, sh.started_at) DESC
        LIMIT 1`,
				[storeId],
			);

			if (result.rows.length === 0) {
				return null;
			}

			const row = result.rows[0];
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
			const db = getPostgresConnection();

			await db.query(
				`INSERT INTO sync_history (
				  store_id, repriced_count, pending_count, unlisted_count,
				  status, error_message, started_at, completed_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[storeId, 0, 0, 0, "in_progress", null, startedAt.toISOString(), null],
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
			const db = getPostgresConnection();

			await db.query(
				`UPDATE sync_history
				SET repriced_count = $1, pending_count = $2, unlisted_count = $3, error_message = $4
				WHERE store_id = $5 AND status = 'in_progress' AND started_at = (
				  SELECT MAX(started_at) FROM sync_history WHERE store_id = $6 AND status = 'in_progress'
				)`,
				[
					repricedCount,
					pendingCount,
					unlistedCount,
					errorMessage || null,
					storeId,
					storeId,
				],
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
			const db = getPostgresConnection();

			const result = await db.query(
				`SELECT 
          id, store_id, repriced_count, pending_count, unlisted_count,
          status, error_message, started_at, completed_at
        FROM sync_history
        WHERE store_id = $1
        ORDER BY completed_at DESC
        LIMIT $2`,
				[storeId, limit],
			);

			return result.rows.map((row) => ({
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
			const db = getPostgresConnection();
			const now = new Date().toISOString();
			const lastSuccess = status === "repriced" ? now : null;

			await db.query(
				`INSERT INTO product_status (
          store_id, platform_product_id, streetpricer_product_id, sku,
          status, last_attempt, last_success, error_message,
          current_price, target_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (store_id, platform_product_id) 
        DO UPDATE SET
          streetpricer_product_id = EXCLUDED.streetpricer_product_id,
          sku = EXCLUDED.sku,
          status = EXCLUDED.status,
          last_attempt = EXCLUDED.last_attempt,
          last_success = EXCLUDED.last_success,
          error_message = EXCLUDED.error_message,
          current_price = EXCLUDED.current_price,
          target_price = EXCLUDED.target_price`,
				[
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
				],
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
			const db = getPostgresConnection();
			let query = `
        SELECT 
          id, store_id, platform_product_id, streetpricer_product_id, sku,
          status, last_attempt, last_success, error_message,
          current_price, target_price
        FROM product_status
        WHERE store_id = $1
      `;

			const params: unknown[] = [storeId];

			if (status) {
				query += " AND status = $2";
				params.push(status);
			}

			query += " ORDER BY last_attempt DESC";

			const result = await db.query(query, params);

			return result.rows.map((row) => ({
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
			const db = getPostgresConnection();

			const repriced = await db.query(
				"SELECT COUNT(*) as count FROM product_status WHERE store_id = $1 AND status = $2",
				[storeId, "repriced"],
			);
			const pending = await db.query(
				"SELECT COUNT(*) as count FROM product_status WHERE store_id = $1 AND status = $2",
				[storeId, "pending"],
			);
			const unlisted = await db.query(
				"SELECT COUNT(*) as count FROM product_status WHERE store_id = $1 AND status = $2",
				[storeId, "unlisted"],
			);

			return {
				repriced: Number.parseInt(repriced.rows[0]?.count || "0"),
				pending: Number.parseInt(pending.rows[0]?.count || "0"),
				unlisted: Number.parseInt(unlisted.rows[0]?.count || "0"),
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
			const db = getPostgresConnection();
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

			const result = await db.query(
				`DELETE FROM product_status
        WHERE store_id = $1 AND last_attempt < $2`,
				[storeId, cutoffDate.toISOString()],
			);

			return result.rowCount || 0;
		} catch (error) {
			throw new Error(
				`Failed to clear old product status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
