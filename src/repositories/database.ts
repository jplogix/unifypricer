import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Database connection utility with proper error handling
 */
export class DatabaseConnection {
	private db: Database.Database | null = null;
	private dbPath: string;

	constructor(
		dbPath: string = process.env.DATABASE_PATH || "./data/price-sync.db",
	) {
		this.dbPath = dbPath;
	}

	/**
	 * Initialize database connection and create schema if needed
	 */
	connect(): Database.Database {
		try {
			// Ensure data directory exists
			const dir = path.dirname(this.dbPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Open database connection
			this.db = new Database(this.dbPath);

			// Enable foreign keys
			this.db.pragma("foreign_keys = ON");

			// Initialize schema
			this.initializeSchema();

			return this.db;
		} catch (error) {
			throw new Error(
				`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get the database instance
	 */
	getDatabase(): Database.Database {
		if (!this.db) {
			throw new Error("Database not connected. Call connect() first.");
		}
		return this.db;
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			try {
				this.db.close();
				this.db = null;
			} catch (error) {
				throw new Error(
					`Failed to close database: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	/**
	 * Initialize database schema with all tables and indexes
	 */
	private initializeSchema(): void {
		if (!this.db) {
			throw new Error("Database not connected");
		}

		try {
			// Create stores table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS stores (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          platform TEXT NOT NULL CHECK(platform IN ('woocommerce', 'shopify')),
          credentials_encrypted TEXT NOT NULL,
          credentials_iv TEXT NOT NULL,
          sync_interval INTEGER DEFAULT 60,
          enabled BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

			// Create sync_history table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS sync_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          store_id TEXT NOT NULL,
          repriced_count INTEGER DEFAULT 0,
          pending_count INTEGER DEFAULT 0,
          unlisted_count INTEGER DEFAULT 0,
          status TEXT NOT NULL CHECK(status IN ('success', 'partial', 'failed', 'in_progress')),
          error_message TEXT,
          started_at DATETIME NOT NULL,
          completed_at DATETIME,
          FOREIGN KEY (store_id) REFERENCES stores(id)
        )
      `);

			// Create product_status table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS product_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          store_id TEXT NOT NULL,
          platform_product_id TEXT NOT NULL,
          streetpricer_product_id TEXT NOT NULL,
          sku TEXT,
          status TEXT NOT NULL CHECK(status IN ('repriced', 'pending', 'unlisted')),
          last_attempt DATETIME NOT NULL,
          last_success DATETIME,
          error_message TEXT,
          current_price REAL,
          target_price REAL,
          FOREIGN KEY (store_id) REFERENCES stores(id),
          UNIQUE(store_id, platform_product_id)
        )
      `);

			// Create audit_logs table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          store_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          action TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id)
        )
      `);

			// Create indexes for performance
			this.createIndexes();
		} catch (error) {
			throw new Error(
				`Failed to initialize schema: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Create database indexes for performance optimization
	 */
	private createIndexes(): void {
		if (!this.db) {
			throw new Error("Database not connected");
		}

		try {
			// Index for sync_history queries by store_id
			this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sync_history_store_id 
        ON sync_history(store_id)
      `);

			// Index for sync_history queries by completion time (for latest sync)
			this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sync_history_completed_at 
        ON sync_history(completed_at DESC)
      `);

			// Index for product_status queries by store_id
			this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_product_status_store_id 
        ON product_status(store_id)
      `);

			// Index for product_status queries by status (for filtering)
			this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_product_status_status 
        ON product_status(status)
      `);
		} catch (error) {
			throw new Error(
				`Failed to create indexes: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Check if database is connected
	 */
	isConnected(): boolean {
		return this.db !== null;
	}
}

// Singleton instance for application-wide use
let dbConnection: DatabaseConnection | null = null;

/**
 * Get or create the singleton database connection
 */
export function getDatabaseConnection(dbPath?: string): DatabaseConnection {
	if (!dbConnection) {
		dbConnection = new DatabaseConnection(dbPath);
	}
	return dbConnection;
}

/**
 * Initialize and connect to the database
 */
export function initializeDatabase(dbPath?: string): Database.Database {
	const connection = getDatabaseConnection(dbPath);
	return connection.connect();
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
	if (dbConnection) {
		dbConnection.close();
		dbConnection = null;
	}
}
