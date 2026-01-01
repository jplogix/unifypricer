import type { Pool, PoolClient, QueryResult } from "pg";
import * as pg from "pg";
import { Logger } from "../utils/logger.js";

const { Pool: PgPool } = pg;
const logger = new Logger("PostgresDatabase");

/**
 * PostgreSQL connection pool with retry logic
 */
export class PostgresConnection {
	private pool: Pool | null = null;
	private connectionString: string;
	private maxRetries = 5;
	private retryDelay = 2000;

	constructor(connectionString?: string) {
		this.connectionString = connectionString || process.env.DATABASE_URL || "";
		if (!this.connectionString) {
			throw new Error("DATABASE_URL is required for PostgreSQL connection");
		}
	}

	/**
	 * Initialize connection pool and create schema
	 */
	async connect(): Promise<Pool> {
		let retries = 0;

		while (retries < this.maxRetries) {
			try {
				this.pool = new PgPool({
					connectionString: this.connectionString,
					max: 20, // Maximum pool size
					idleTimeoutMillis: 30000,
					connectionTimeoutMillis: 10000,
				});

				// Test connection
				const client = await this.pool.connect();
				logger.info("PostgreSQL connection established");
				client.release();

				// Initialize schema
				await this.initializeSchema();

				return this.pool;
			} catch (error) {
				retries++;
				logger.error(
					`Failed to connect to PostgreSQL (attempt ${retries}/${this.maxRetries}):`,
					{ error: error instanceof Error ? error.message : String(error) },
				);

				if (retries < this.maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
				} else {
					throw new Error(
						`Failed to connect to PostgreSQL after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}

		throw new Error("Failed to connect to PostgreSQL");
	}

	/**
	 * Get the connection pool
	 */
	getPool(): Pool {
		if (!this.pool) {
			throw new Error("Database not connected. Call connect() first.");
		}
		return this.pool;
	}

	/**
	 * Execute a query
	 */
	async query<T = unknown>(
		text: string,
		params?: unknown[],
	): Promise<QueryResult<T>> {
		const pool = this.getPool();
		return pool.query(text, params);
	}

	/**
	 * Get a client from the pool for transactions
	 */
	async getClient(): Promise<PoolClient> {
		const pool = this.getPool();
		return pool.connect();
	}

	/**
	 * Close the connection pool
	 */
	async close(): Promise<void> {
		if (this.pool) {
			try {
				await this.pool.end();
				this.pool = null;
				logger.info("PostgreSQL connection closed");
			} catch (error) {
				throw new Error(
					`Failed to close PostgreSQL connection: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	/**
	 * Initialize database schema
	 */
	private async initializeSchema(): Promise<void> {
		if (!this.pool) {
			throw new Error("Database not connected");
		}

		try {
			// Create stores table
			await this.pool.query(`
        CREATE TABLE IF NOT EXISTS stores (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL CHECK(platform IN ('woocommerce', 'shopify')),
          credentials_encrypted TEXT NOT NULL,
          credentials_iv VARCHAR(255) NOT NULL,
          sync_interval INTEGER DEFAULT 60,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

			// Create sync_history table
			await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sync_history (
          id SERIAL PRIMARY KEY,
          store_id VARCHAR(255) NOT NULL,
          repriced_count INTEGER DEFAULT 0,
          pending_count INTEGER DEFAULT 0,
          unlisted_count INTEGER DEFAULT 0,
          status VARCHAR(50) NOT NULL CHECK(status IN ('success', 'partial', 'failed', 'in_progress')),
          error_message TEXT,
          started_at TIMESTAMPTZ NOT NULL,
          completed_at TIMESTAMPTZ,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);

			// Create product_status table
			await this.pool.query(`
        CREATE TABLE IF NOT EXISTS product_status (
          id SERIAL PRIMARY KEY,
          store_id VARCHAR(255) NOT NULL,
          platform_product_id VARCHAR(255) NOT NULL,
          streetpricer_product_id VARCHAR(255) NOT NULL,
          sku VARCHAR(255),
          status VARCHAR(50) NOT NULL CHECK(status IN ('repriced', 'pending', 'unlisted')),
          last_attempt TIMESTAMPTZ NOT NULL,
          last_success TIMESTAMPTZ,
          error_message TEXT,
          current_price DECIMAL(10,2),
          target_price DECIMAL(10,2),
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
          UNIQUE(store_id, platform_product_id)
        )
      `);

			// Create audit_logs table
			await this.pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          store_id VARCHAR(255) NOT NULL,
          product_id VARCHAR(255) NOT NULL,
          action VARCHAR(255) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          details TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);

			// Create indexes
			await this.createIndexes();

			logger.info("PostgreSQL schema initialized");
		} catch (error) {
			throw new Error(
				`Failed to initialize schema: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Create database indexes
	 */
	private async createIndexes(): Promise<void> {
		if (!this.pool) {
			throw new Error("Database not connected");
		}

		try {
			await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_history_store_id 
        ON sync_history(store_id)
      `);

			await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_history_completed_at 
        ON sync_history(completed_at DESC)
      `);

			await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_product_status_store_id 
        ON product_status(store_id)
      `);

			await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_product_status_status 
        ON product_status(status)
      `);
		} catch (error) {
			// Indexes might already exist, log but don't throw
			logger.warn("Some indexes may already exist:", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Check if database is connected
	 */
	isConnected(): boolean {
		return this.pool !== null;
	}
}

// Singleton instance
let pgConnection: PostgresConnection | null = null;

/**
 * Get or create the singleton PostgreSQL connection
 */
export function getPostgresConnection(
	connectionString?: string,
): PostgresConnection {
	if (!pgConnection) {
		pgConnection = new PostgresConnection(connectionString);
	}
	return pgConnection;
}

/**
 * Initialize and connect to PostgreSQL
 */
export async function initializePostgres(
	connectionString?: string,
): Promise<Pool> {
	const connection = getPostgresConnection(connectionString);
	return connection.connect();
}

/**
 * Close PostgreSQL connection
 */
export async function closePostgres(): Promise<void> {
	if (pgConnection) {
		await pgConnection.close();
		pgConnection = null;
	}
}
