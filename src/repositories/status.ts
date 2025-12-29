import Database from 'better-sqlite3';
import { getDatabaseConnection } from './database.js';
import {
  StoreSyncResult,
  SyncHistoryRecord,
  ProductStatus,
  ProductStatusRecord,
  ProductSyncStatus,
  SyncStatus
} from '../types/index.js';

/**
 * Repository for managing sync status and product status data
 */
export class StatusRepository {
  constructor(private dbPath?: string) { }

  private getDb(): Database {
    const connection = getDatabaseConnection(this.dbPath);
    return connection.getDatabase();
  }

  /**
   * Save sync result to database
   */
  async saveSyncResult(result: StoreSyncResult): Promise<void> {
    try {
      const stmt = this.getDb().prepare(`
        INSERT INTO sync_history (
          store_id, repriced_count, pending_count, unlisted_count,
          status, error_message, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Determine overall status based on errors
      let status: SyncStatus = 'success';
      let errorMessage: string | null = null;

      if (result.errors.length > 0) {
        status = result.errors.length === (result.repricedCount + result.pendingCount) ? 'failed' : 'partial';
        errorMessage = result.errors.map(e => `${e.productId}: ${e.errorMessage}`).join('; ');
      }

      stmt.run(
        result.storeId,
        result.repricedCount,
        result.pendingCount,
        result.unlistedCount,
        status,
        errorMessage,
        result.timestamp.toISOString(),
        result.timestamp.toISOString()
      );
    } catch (error) {
      throw new Error(`Failed to save sync result: ${error instanceof Error ? error.message : String(error)}`);
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
          sh.completed_at
        FROM sync_history sh
        JOIN stores s ON sh.store_id = s.id
        WHERE sh.store_id = ?
        ORDER BY sh.completed_at DESC
        LIMIT 1
      `);

      const row = stmt.get(storeId) as any;

      if (!row) {
        return null;
      }

      // Parse errors from error_message
      const errors = row.error_message
        ? row.error_message.split('; ').map((errorStr: string) => {
          const [productId, ...messageParts] = errorStr.split(': ');
          return {
            productId,
            errorMessage: messageParts.join(': '),
            errorType: 'network' as const // Default error type
          };
        })
        : [];

      return {
        storeId: row.store_id,
        storeName: row.store_name,
        platform: row.platform,
        repricedCount: row.repriced_count,
        pendingCount: row.pending_count,
        unlistedCount: row.unlisted_count,
        errors,
        timestamp: new Date(row.completed_at)
      };
    } catch (error) {
      throw new Error(`Failed to get latest sync status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get sync history for a store with optional limit
   */
  async getSyncHistory(storeId: string, limit: number = 10): Promise<SyncHistoryRecord[]> {
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

      const rows = stmt.all(storeId, limit) as any[];

      return rows.map(row => ({
        id: row.id,
        storeId: row.store_id,
        repricedCount: row.repriced_count,
        pendingCount: row.pending_count,
        unlistedCount: row.unlisted_count,
        status: row.status,
        errorMessage: row.error_message || undefined,
        startedAt: new Date(row.started_at),
        completedAt: new Date(row.completed_at)
      }));
    } catch (error) {
      throw new Error(`Failed to get sync history: ${error instanceof Error ? error.message : String(error)}`);
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
    errorMessage?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const lastSuccess = status === 'repriced' ? now : null;

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
        targetPrice
      );
    } catch (error) {
      throw new Error(`Failed to update product status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get product status records for a store, optionally filtered by status
   */
  async getProductStatus(storeId: string, status?: ProductSyncStatus): Promise<ProductStatusRecord[]> {
    try {
      let query = `
        SELECT 
          id, store_id, platform_product_id, streetpricer_product_id, sku,
          status, last_attempt, last_success, error_message,
          current_price, target_price
        FROM product_status
        WHERE store_id = ?
      `;

      const params: any[] = [storeId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY last_attempt DESC';

      const stmt = this.getDb().prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => ({
        id: row.id,
        storeId: row.store_id,
        platformProductId: row.platform_product_id,
        streetpricerProductId: row.streetpricer_product_id,
        sku: row.sku,
        status: row.status,
        lastAttempt: new Date(row.last_attempt),
        lastSuccess: row.last_success ? new Date(row.last_success) : undefined,
        errorMessage: row.error_message || undefined,
        currentPrice: row.current_price,
        targetPrice: row.target_price
      }));
    } catch (error) {
      throw new Error(`Failed to get product status: ${error instanceof Error ? error.message : String(error)}`);
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

      const repriced = db.query('SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?').get(storeId, 'repriced') as { count: number } | null;
      const pending = db.query('SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?').get(storeId, 'pending') as { count: number } | null;
      const unlisted = db.query('SELECT COUNT(*) as count FROM product_status WHERE store_id = ? AND status = ?').get(storeId, 'unlisted') as { count: number } | null;

      return {
        repriced: repriced?.count || 0,
        pending: pending?.count || 0,
        unlisted: unlisted?.count || 0
      };
    } catch (error) {
      throw new Error(`Failed to get product status counts: ${error instanceof Error ? error.message : String(error)}`);
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
  async clearOldProductStatus(storeId: string, olderThanDays: number = 30): Promise<number> {
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
      throw new Error(`Failed to clear old product status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}