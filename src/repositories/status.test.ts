import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fc from 'fast-check';
import { StatusRepository } from './status.js';
import { DatabaseConnection, getDatabaseConnection, closeDatabase } from './database.js';
import { StoreSyncResult, ProductSyncStatus } from '../types/index.js';

describe('StatusRepository', () => {
  let statusRepo: StatusRepository;
  let dbConnection: DatabaseConnection;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    // Ensure clean state
    closeDatabase();

    // Get singleton connection
    dbConnection = getDatabaseConnection(testDbPath);
    dbConnection.connect();

    // Create StatusRepository (will use the same singleton)
    statusRepo = new StatusRepository(testDbPath);

    // Insert test store
    const db = dbConnection.getDatabase();
    db.run(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES ('test-store', 'Test Store', 'woocommerce', 'encrypted', 'iv')
    `);
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('saveSyncResult', () => {
    it('should save sync result with success status', async () => {
      const syncResult: StoreSyncResult = {
        storeId: 'test-store',
        storeName: 'Test Store',
        platform: 'woocommerce',
        repricedCount: 5,
        pendingCount: 2,
        unlistedCount: 3,
        errors: [],
        timestamp: new Date('2024-01-01T10:00:00Z')
      };

      await statusRepo.saveSyncResult(syncResult);

      // Verify the record was saved
      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM sync_history WHERE store_id = ?');
      const record = stmt.get('test-store') as any;

      expect(record).toBeDefined();
      expect(record.store_id).toBe('test-store');
      expect(record.repriced_count).toBe(5);
      expect(record.pending_count).toBe(2);
      expect(record.unlisted_count).toBe(3);
      expect(record.status).toBe('success');
      expect(record.error_message).toBeNull();
    });

    it('should save sync result with partial status when there are errors', async () => {
      const syncResult: StoreSyncResult = {
        storeId: 'test-store',
        storeName: 'Test Store',
        platform: 'woocommerce',
        repricedCount: 3,
        pendingCount: 2,
        unlistedCount: 1,
        errors: [
          { productId: 'prod1', errorMessage: 'Network error', errorType: 'network' }
        ],
        timestamp: new Date('2024-01-01T10:00:00Z')
      };

      await statusRepo.saveSyncResult(syncResult);

      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM sync_history WHERE store_id = ?');
      const record = stmt.get('test-store') as any;

      expect(record.status).toBe('partial');
      expect(record.error_message).toBe('prod1: Network error');
    });

    it('should save sync result with failed status when all operations failed', async () => {
      const syncResult: StoreSyncResult = {
        storeId: 'test-store',
        storeName: 'Test Store',
        platform: 'woocommerce',
        repricedCount: 0,
        pendingCount: 2,
        unlistedCount: 0,
        errors: [
          { productId: 'prod1', errorMessage: 'Auth failed', errorType: 'authentication' },
          { productId: 'prod2', errorMessage: 'Validation error', errorType: 'validation' }
        ],
        timestamp: new Date('2024-01-01T10:00:00Z')
      };

      await statusRepo.saveSyncResult(syncResult);

      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM sync_history WHERE store_id = ?');
      const record = stmt.get('test-store') as any;

      expect(record.status).toBe('failed');
      expect(record.error_message).toContain('prod1: Auth failed');
      expect(record.error_message).toContain('prod2: Validation error');
    });
  });

  describe('getLatestSyncStatus', () => {
    it('should return latest sync status for a store', async () => {
      // Insert test sync records
      const db = dbConnection.getDatabase();
      db.run(`
        INSERT INTO sync_history (store_id, repriced_count, pending_count, unlisted_count, status, started_at, completed_at)
        VALUES 
          ('test-store', 3, 1, 2, 'success', '2024-01-01T09:00:00Z', '2024-01-01T09:30:00Z'),
          ('test-store', 5, 2, 1, 'partial', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z')
      `);

      const result = await statusRepo.getLatestSyncStatus('test-store');

      expect(result).toBeDefined();
      expect(result!.storeId).toBe('test-store');
      expect(result!.storeName).toBe('Test Store');
      expect(result!.platform).toBe('woocommerce');
      expect(result!.repricedCount).toBe(5);
      expect(result!.pendingCount).toBe(2);
      expect(result!.unlistedCount).toBe(1);
      expect(result!.timestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
    });

    it('should return null for store with no sync history', async () => {
      const result = await statusRepo.getLatestSyncStatus('nonexistent-store');
      expect(result).toBeNull();
    });

    it('should parse errors from error_message field', async () => {
      const db = dbConnection.getDatabase();
      db.run(`
        INSERT INTO sync_history (store_id, repriced_count, pending_count, unlisted_count, status, error_message, started_at, completed_at)
        VALUES ('test-store', 2, 1, 0, 'partial', 'prod1: Network timeout; prod2: Invalid price', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z')
      `);

      const result = await statusRepo.getLatestSyncStatus('test-store');

      expect(result!.errors).toHaveLength(2);
      expect(result!.errors[0].productId).toBe('prod1');
      expect(result!.errors[0].errorMessage).toBe('Network timeout');
      expect(result!.errors[1].productId).toBe('prod2');
      expect(result!.errors[1].errorMessage).toBe('Invalid price');
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history ordered by completion time', async () => {
      const db = dbConnection.getDatabase();
      db.run(`
        INSERT INTO sync_history (store_id, repriced_count, pending_count, unlisted_count, status, started_at, completed_at)
        VALUES 
          ('test-store', 1, 0, 0, 'success', '2024-01-01T08:00:00Z', '2024-01-01T08:30:00Z'),
          ('test-store', 2, 1, 0, 'partial', '2024-01-01T09:00:00Z', '2024-01-01T09:30:00Z'),
          ('test-store', 3, 0, 1, 'success', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z')
      `);

      const history = await statusRepo.getSyncHistory('test-store', 5);

      expect(history).toHaveLength(3);
      expect(history[0].repricedCount).toBe(3); // Most recent first
      expect(history[1].repricedCount).toBe(2);
      expect(history[2].repricedCount).toBe(1);
    });

    it('should respect the limit parameter', async () => {
      const db = dbConnection.getDatabase();
      db.run(`
        INSERT INTO sync_history (store_id, repriced_count, pending_count, unlisted_count, status, started_at, completed_at)
        VALUES 
          ('test-store', 1, 0, 0, 'success', '2024-01-01T08:00:00Z', '2024-01-01T08:30:00Z'),
          ('test-store', 2, 1, 0, 'partial', '2024-01-01T09:00:00Z', '2024-01-01T09:30:00Z'),
          ('test-store', 3, 0, 1, 'success', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z')
      `);

      const history = await statusRepo.getSyncHistory('test-store', 2);

      expect(history).toHaveLength(2);
      expect(history[0].repricedCount).toBe(3);
      expect(history[1].repricedCount).toBe(2);
    });
  });

  describe('updateProductStatus', () => {
    it('should insert new product status record', async () => {
      await statusRepo.updateProductStatus(
        'test-store',
        'platform-123',
        'street-456',
        'SKU-ABC',
        'repriced',
        19.99,
        24.99
      );

      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM product_status WHERE store_id = ? AND platform_product_id = ?');
      const record = stmt.get('test-store', 'platform-123') as any;

      expect(record).toBeDefined();
      expect(record.store_id).toBe('test-store');
      expect(record.platform_product_id).toBe('platform-123');
      expect(record.streetpricer_product_id).toBe('street-456');
      expect(record.sku).toBe('SKU-ABC');
      expect(record.status).toBe('repriced');
      expect(record.current_price).toBe(19.99);
      expect(record.target_price).toBe(24.99);
      expect(record.last_success).toBeDefined(); // Should be set for repriced status
    });

    it('should update existing product status record', async () => {
      // Insert initial record
      await statusRepo.updateProductStatus(
        'test-store',
        'platform-123',
        'street-456',
        'SKU-ABC',
        'pending',
        19.99,
        24.99,
        'Network error'
      );

      // Update the same record
      await statusRepo.updateProductStatus(
        'test-store',
        'platform-123',
        'street-456',
        'SKU-ABC',
        'repriced',
        24.99,
        24.99
      );

      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM product_status WHERE store_id = ? AND platform_product_id = ?');
      const record = stmt.get('test-store', 'platform-123') as any;

      expect(record.status).toBe('repriced');
      expect(record.current_price).toBe(24.99);
      expect(record.error_message).toBeNull();
      expect(record.last_success).toBeDefined();
    });

    it('should handle pending status with error message', async () => {
      await statusRepo.updateProductStatus(
        'test-store',
        'platform-123',
        'street-456',
        'SKU-ABC',
        'pending',
        19.99,
        24.99,
        'API rate limit exceeded'
      );

      const db = dbConnection.getDatabase();
      const stmt = db.prepare('SELECT * FROM product_status WHERE store_id = ? AND platform_product_id = ?');
      const record = stmt.get('test-store', 'platform-123') as any;

      expect(record.status).toBe('pending');
      expect(record.error_message).toBe('API rate limit exceeded');
      expect(record.last_success).toBeNull(); // Should not be set for pending status
    });
  });

  describe('getProductStatus', () => {
    beforeEach(async () => {
      // Insert test product status records
      await statusRepo.updateProductStatus('test-store', 'prod1', 'street1', 'SKU1', 'repriced', 10.00, 12.00);
      await statusRepo.updateProductStatus('test-store', 'prod2', 'street2', 'SKU2', 'pending', 15.00, 18.00, 'Network error');
      await statusRepo.updateProductStatus('test-store', 'prod3', 'street3', 'SKU3', 'unlisted', 0, 20.00);
    });

    it('should return all product status records for a store', async () => {
      const records = await statusRepo.getProductStatus('test-store');

      expect(records).toHaveLength(3);
      expect(records.map(r => r.status)).toContain('repriced');
      expect(records.map(r => r.status)).toContain('pending');
      expect(records.map(r => r.status)).toContain('unlisted');
    });

    it('should filter by status when provided', async () => {
      const repricedRecords = await statusRepo.getProductStatus('test-store', 'repriced');
      const pendingRecords = await statusRepo.getProductStatus('test-store', 'pending');

      expect(repricedRecords).toHaveLength(1);
      expect(repricedRecords[0].status).toBe('repriced');
      expect(repricedRecords[0].sku).toBe('SKU1');

      expect(pendingRecords).toHaveLength(1);
      expect(pendingRecords[0].status).toBe('pending');
      expect(pendingRecords[0].errorMessage).toBe('Network error');
    });
  });

  describe('getProductStatusCounts', () => {
    beforeEach(async () => {
      // Insert test product status records
      await statusRepo.updateProductStatus('test-store', 'prod1', 'street1', 'SKU1', 'repriced', 10.00, 12.00);
      await statusRepo.updateProductStatus('test-store', 'prod2', 'street2', 'SKU2', 'repriced', 15.00, 18.00);
      await statusRepo.updateProductStatus('test-store', 'prod3', 'street3', 'SKU3', 'pending', 20.00, 25.00);
      await statusRepo.updateProductStatus('test-store', 'prod4', 'street4', 'SKU4', 'unlisted', 0, 30.00);
      await statusRepo.updateProductStatus('test-store', 'prod5', 'street5', 'SKU5', 'unlisted', 0, 35.00);
    });

    it('should return correct counts for each status', async () => {
      const counts = await statusRepo.getProductStatusCounts('test-store');

      expect(counts.repriced).toBe(2);
      expect(counts.pending).toBe(1);
      expect(counts.unlisted).toBe(2);
    });

    it('should return zero counts for store with no products', async () => {
      const counts = await statusRepo.getProductStatusCounts('empty-store');

      expect(counts.repriced).toBe(0);
      expect(counts.pending).toBe(0);
      expect(counts.unlisted).toBe(0);
    });
  });

  describe('clearOldProductStatus', () => {
    it('should remove old product status records', async () => {
      const db = dbConnection.getDatabase();

      // Insert old record (35 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      db.query(`
        INSERT INTO product_status (store_id, platform_product_id, streetpricer_product_id, sku, status, last_attempt, current_price, target_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('test-store', 'old-prod', 'street-old', 'OLD-SKU', 'repriced', oldDate.toISOString(), 10.00, 12.00);

      // Insert recent record
      await statusRepo.updateProductStatus('test-store', 'new-prod', 'street-new', 'NEW-SKU', 'repriced', 15.00, 18.00);

      const deletedCount = await statusRepo.clearOldProductStatus('test-store', 30);

      expect(deletedCount).toBe(1);

      // Verify only recent record remains
      const records = await statusRepo.getProductStatus('test-store');
      expect(records).toHaveLength(1);
      expect(records[0].platformProductId).toBe('new-prod');
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: price-sync-dashboard, Property 9: Mapping record creation
    // Validates: Requirement 2.2, 3.2
    it('Property 9.1: For any set of product status updates, the system should strictly create or update mapping records', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              platformProductId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
              streetPricerId: fc.string({ minLength: 1 }),
              sku: fc.string({ minLength: 1 }),
              status: fc.constantFrom('repriced', 'pending', 'unlisted'),
              currentPrice: fc.double({ min: 0, noNaN: true, noInfinity: true }),
              targetPrice: fc.double({ min: 0, noNaN: true, noInfinity: true }),
              errorMessage: fc.option(fc.string({ minLength: 1 }), { nil: undefined })
            }),
            { minLength: 1, maxLength: 50 } // Limit size for perf
          ),
          async (updates) => {
            // Clear DB entries first (though we use fresh DB in beforeEach, but iterating here)
            // Actually, let's use the repo methods.

            // NOTE: We need fresh DB state per property run if we want total isolation.
            // Since we can't easily reset the in-memory DB used by existing beforeEach inside the property loop 
            // (unless we manually delete all), we can just insert unique platform IDs or rely on upsert.
            // The repo `updateProductStatus` handles upsert (INSERT OR REPLACE usually or UPDATE).
            // Let's check implementation if it's INSERT OR REPLACE.
            // Assuming it handles it (unit tests suggest it does).

            const storedUpdates = new Map();

            // Apply updates
            for (const update of updates) {
              // Ensure uniqueness of platformProductId for this simplified test verification
              // Or just accept the last one wins.

              await statusRepo.updateProductStatus(
                'test-store',
                update.platformProductId,
                update.streetPricerId,
                update.sku,
                update.status as any,
                update.currentPrice,
                update.targetPrice,
                update.errorMessage
              );

              storedUpdates.set(update.platformProductId, update);
            }

            // Verify
            const allRecords = await statusRepo.getProductStatus('test-store');

            for (const [id, update] of storedUpdates.entries()) {
              const record = allRecords.find(r => r.platformProductId === id);
              if (!record) {
                console.error('Record not found for id:', id);
                console.error('Available records:', allRecords.map(r => r.platformProductId));
                throw new Error(`Record not found for id: ${id}`);
              }

              try {
                expect(record!.streetpricerProductId).toBe(update.streetPricerId);
                expect(record!.sku).toBe(update.sku);
                expect(record!.status).toBe(update.status);
                expect(record!.currentPrice).toBeCloseTo(update.currentPrice, 3);
                expect(record!.targetPrice).toBeCloseTo(update.targetPrice, 3);

                if (update.errorMessage) {
                  expect(record!.errorMessage).toBe(update.errorMessage);
                }
              } catch (e) {
                console.error('Mismatch for id:', id);
                console.error('Update:', update);
                console.error('Record:', record);
                console.error('Error:', e);
                throw e;
              }
            }
          }
        ),
        { numRuns: 20 } // removed verbose: true from here as it's not a valid option for fc.assert in older versions, but console log helps
      );
    });
  });
});