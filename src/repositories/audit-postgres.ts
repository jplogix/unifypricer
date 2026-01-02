import type { AuditLogEntry, IAuditRepository } from "./audit.js";
import { getPostgresConnection } from "./postgres-database.js";

export class AuditRepositoryPostgres implements IAuditRepository {
	async log(entry: AuditLogEntry): Promise<void> {
		try {
			const db = getPostgresConnection();

			await db.query(
				`INSERT INTO audit_logs (
                    store_id, product_id, action, old_value, new_value, details, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
				[
					entry.storeId,
					entry.productId,
					entry.action,
					entry.oldValue || null,
					entry.newValue || null,
					entry.details || null,
				],
			);
		} catch (error) {
			console.error("Failed to save audit log:", error);
			// We generally don't want audit logging failure to crash the main flow,
			// but in high security it might. For this app, logging to stderr is fallback.
		}
	}

	async getLogs(storeId: string, limit: number = 50): Promise<AuditLogEntry[]> {
		const db = getPostgresConnection();

		const result = await db.query(
			`SELECT store_id, product_id, action, old_value, new_value, details, created_at 
            FROM audit_logs 
            WHERE store_id = $1
            ORDER BY created_at DESC 
            LIMIT $2`,
			[storeId, limit],
		);

		return result.rows.map((row) => ({
			storeId: row.store_id,
			productId: row.product_id,
			action: row.action,
			oldValue: row.old_value,
			newValue: row.new_value,
			details: row.details,
		}));
	}
}
