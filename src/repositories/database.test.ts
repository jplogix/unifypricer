import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseConnection, initializeDatabase, closeDatabase } from './database';
import fs from 'fs';
import path from 'path';

describe('DatabaseConnection', () => {
  const testDbPath = './data/test-price-sync.db';

  beforeEach(() => {
    // Clean up test database before each test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    // Clean up test database after each test
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should create database file and directory if they do not exist', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    dbConnection.connect();

    expect(fs.existsSync(testDbPath)).toBe(true);
    
    dbConnection.close();
  });

  test('should enable foreign keys on connection', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    const result = db.query('PRAGMA foreign_keys').get() as any;
    expect(result.foreign_keys).toBe(1);
    
    dbConnection.close();
  });

  test('should create stores table with correct schema', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    const tableInfo = db.query('PRAGMA table_info(stores)').all();
    const columnNames = tableInfo.map((col: any) => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('platform');
    expect(columnNames).toContain('credentials_encrypted');
    expect(columnNames).toContain('credentials_iv');
    expect(columnNames).toContain('sync_interval');
    expect(columnNames).toContain('enabled');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
    
    dbConnection.close();
  });

  test('should create sync_history table with correct schema', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    const tableInfo = db.query('PRAGMA table_info(sync_history)').all();
    const columnNames = tableInfo.map((col: any) => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('store_id');
    expect(columnNames).toContain('repriced_count');
    expect(columnNames).toContain('pending_count');
    expect(columnNames).toContain('unlisted_count');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('error_message');
    expect(columnNames).toContain('started_at');
    expect(columnNames).toContain('completed_at');
    
    dbConnection.close();
  });

  test('should create product_status table with correct schema', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    const tableInfo = db.query('PRAGMA table_info(product_status)').all();
    const columnNames = tableInfo.map((col: any) => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('store_id');
    expect(columnNames).toContain('platform_product_id');
    expect(columnNames).toContain('streetpricer_product_id');
    expect(columnNames).toContain('sku');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('last_attempt');
    expect(columnNames).toContain('last_success');
    expect(columnNames).toContain('error_message');
    expect(columnNames).toContain('current_price');
    expect(columnNames).toContain('target_price');
    
    dbConnection.close();
  });

  test('should create all required indexes', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    const indexes = db.query('PRAGMA index_list(sync_history)').all();
    const syncHistoryIndexNames = indexes.map((idx: any) => idx.name);
    
    expect(syncHistoryIndexNames).toContain('idx_sync_history_store_id');
    expect(syncHistoryIndexNames).toContain('idx_sync_history_completed_at');

    const productIndexes = db.query('PRAGMA index_list(product_status)').all();
    const productStatusIndexNames = productIndexes.map((idx: any) => idx.name);
    
    expect(productStatusIndexNames).toContain('idx_product_status_store_id');
    expect(productStatusIndexNames).toContain('idx_product_status_status');
    
    dbConnection.close();
  });

  test('should enforce platform CHECK constraint on stores table', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    // Valid platform should work
    const insertValid = db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertValid.run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');
    }).not.toThrow();

    // Invalid platform should fail
    const insertInvalid = db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertInvalid.run('store2', 'Test Store 2', 'invalid_platform', 'encrypted', 'iv');
    }).toThrow();
    
    dbConnection.close();
  });

  test('should enforce status CHECK constraint on sync_history table', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    // First insert a store
    db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `).run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');

    // Valid status should work
    const insertValid = db.query(`
      INSERT INTO sync_history (store_id, status, started_at, completed_at)
      VALUES (?, ?, ?, ?)
    `);
    
    expect(() => {
      insertValid.run('store1', 'success', new Date().toISOString(), new Date().toISOString());
    }).not.toThrow();

    // Invalid status should fail
    const insertInvalid = db.query(`
      INSERT INTO sync_history (store_id, status, started_at, completed_at)
      VALUES (?, ?, ?, ?)
    `);
    
    expect(() => {
      insertInvalid.run('store1', 'invalid_status', new Date().toISOString(), new Date().toISOString());
    }).toThrow();
    
    dbConnection.close();
  });

  test('should enforce status CHECK constraint on product_status table', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    // First insert a store
    db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `).run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');

    // Valid status should work
    const insertValid = db.query(`
      INSERT INTO product_status (store_id, platform_product_id, streetpricer_product_id, status, last_attempt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertValid.run('store1', 'prod1', 'sp1', 'repriced', new Date().toISOString());
    }).not.toThrow();

    // Invalid status should fail
    const insertInvalid = db.query(`
      INSERT INTO product_status (store_id, platform_product_id, streetpricer_product_id, status, last_attempt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertInvalid.run('store1', 'prod2', 'sp2', 'invalid_status', new Date().toISOString());
    }).toThrow();
    
    dbConnection.close();
  });

  test('should enforce UNIQUE constraint on product_status (store_id, platform_product_id)', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    // First insert a store
    db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `).run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');

    // First insert should work
    const insert = db.query(`
      INSERT INTO product_status (store_id, platform_product_id, streetpricer_product_id, status, last_attempt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insert.run('store1', 'prod1', 'sp1', 'repriced', new Date().toISOString());

    // Duplicate should fail
    expect(() => {
      insert.run('store1', 'prod1', 'sp2', 'pending', new Date().toISOString());
    }).toThrow();
    
    dbConnection.close();
  });

  test('should throw error when trying to get database before connecting', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    
    expect(() => {
      dbConnection.getDatabase();
    }).toThrow('Database not connected');
  });

  test('should return database instance after connecting', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    dbConnection.connect();
    
    const db = dbConnection.getDatabase();
    expect(db).toBeDefined();
    expect(dbConnection.isConnected()).toBe(true);
    
    dbConnection.close();
  });

  test('should handle connection errors gracefully', () => {
    // Try to create database in invalid path
    const dbConnection = new DatabaseConnection('/invalid/path/db.sqlite');
    
    expect(() => {
      dbConnection.connect();
    }).toThrow('Failed to connect to database');
  });

  test('should close database connection successfully', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    dbConnection.connect();
    
    expect(dbConnection.isConnected()).toBe(true);
    
    dbConnection.close();
    expect(dbConnection.isConnected()).toBe(false);
  });

  test('initializeDatabase helper should create and return database', () => {
    const db = initializeDatabase(testDbPath);
    
    expect(db).toBeDefined();
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  test('should set default values for stores table', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `).run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');

    const store = db.query('SELECT * FROM stores WHERE id = ?').get('store1') as any;
    
    expect(store.sync_interval).toBe(60);
    expect(store.enabled).toBe(1);
    expect(store.created_at).toBeDefined();
    expect(store.updated_at).toBeDefined();
    
    dbConnection.close();
  });

  test('should set default values for sync_history table', () => {
    const dbConnection = new DatabaseConnection(testDbPath);
    const db = dbConnection.connect();

    // Insert store first
    db.query(`
      INSERT INTO stores (id, name, platform, credentials_encrypted, credentials_iv)
      VALUES (?, ?, ?, ?, ?)
    `).run('store1', 'Test Store', 'woocommerce', 'encrypted', 'iv');

    // Insert sync history without counts
    db.query(`
      INSERT INTO sync_history (store_id, status, started_at, completed_at)
      VALUES (?, ?, ?, ?)
    `).run('store1', 'success', new Date().toISOString(), new Date().toISOString());

    const history = db.query('SELECT * FROM sync_history WHERE store_id = ?').get('store1') as any;
    
    expect(history.repriced_count).toBe(0);
    expect(history.pending_count).toBe(0);
    expect(history.unlisted_count).toBe(0);
    
    dbConnection.close();
  });
});
