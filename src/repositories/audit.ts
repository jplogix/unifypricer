import type Database from "better-sqlite3";
import { getDatabaseConnection } from "./database.js";

export interface AuditLogEntry {
	storeId: string;
	productId: string;
	action: string;
	oldValue?: string;
	newValue?: string;
	details?: string;
}

/**
 * Interface for audit repository - enables both SQLite and PostgreSQL implementations
 */
export interface IAuditRepository {
	log(entry: AuditLogEntry): Promise<void>;
	getLogs(storeId: string, limit?: number): Promise<AuditLogEntry[]>;
}

export class AuditRepository implements IAuditRepository {
	constructor(private dbPath?: string) {}

	private getDb(): Database.Database {
		const connection = getDatabaseConnection(this.dbPath);
		return connection.getDatabase();
	}

	async log(entry: AuditLogEntry): Promise<void> {
		try {
			const stmt = this.getDb().prepare(`
                INSERT INTO audit_logs (
                    store_id, product_id, action, old_value, new_value, details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

			stmt.run(
				entry.storeId,
				entry.productId,
				entry.action,
				entry.oldValue || null,
				entry.newValue || null,
				entry.details || null,
			);
		} catch (error) {
			console.error("Failed to save audit log:", error);
			// We generally don't want audit logging failure to crash the main flow,
			// but in high security it might. For this app, logging to stderr is fallback.
		}
	}

	async getLogs(storeId: string, limit: number = 50): Promise<AuditLogEntry[]> {
		const stmt = this.getDb().prepare(`
            SELECT * FROM audit_logs 
            WHERE store_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
		return stmt.all(storeId, limit) as AuditLogEntry[];
	}
}
