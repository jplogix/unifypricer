import { describe } from "node:test";
import fc from "fast-check";
import request from "supertest";
import app from "../index";
import { ConfigRepository, createStoreConfig } from "../repositories/config";
import {
	getDatabaseConnection,
	initializeDatabase,
} from "../repositories/database";
import { StatusRepository } from "../repositories/status";

const TEST_DB_PATH = "./data/test-api-property.db";

describe("API Property Tests", () => {
	let statusRepo: StatusRepository;
	let configRepo: ConfigRepository;

	beforeAll(async () => {
		// Setup fresh DB
		process.env.DATABASE_PATH = TEST_DB_PATH;
		process.env.ENCRYPTION_KEY =
			"0000000000000000000000000000000000000000000000000000000000000000";

		// Initialize DB explicitly since index.ts doesn't do it in test mode
		initializeDatabase(TEST_DB_PATH);

		statusRepo = new StatusRepository();
		configRepo = new ConfigRepository();

		const db = getDatabaseConnection().getDatabase();
		db.run("DELETE FROM audit_logs");
		db.run("DELETE FROM product_status");
		db.run("DELETE FROM sync_history");
		db.run("DELETE FROM stores");
	});

	afterAll(() => {
		const db = getDatabaseConnection().getDatabase();
		db.run("DELETE FROM audit_logs");
		db.run("DELETE FROM product_status");
		db.run("DELETE FROM sync_history");
		db.run("DELETE FROM stores");
	});

	it("Property 13: Dashboard count accuracy", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc
					.string({ minLength: 5 })
					.filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)), // storeId (URL safe)
				fc.integer({ min: 0, max: 100 }), // repriced
				fc.integer({ min: 0, max: 100 }), // pending
				fc.integer({ min: 0, max: 100 }), // unlisted
				async (storeId, repriced, pending, unlisted) => {
					// 1. Setup Store
					const db = getDatabaseConnection().getDatabase();
					db.run("DELETE FROM audit_logs WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM product_status WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM sync_history WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM stores WHERE id = ?", [storeId]);

					const config = createStoreConfig(
						storeId,
						`Store ${storeId}`,
						"woocommerce",
						{ url: "http://test", consumerKey: "k", consumerSecret: "s" },
						60,
						true,
						process.env.ENCRYPTION_KEY,
					);
					configRepo.saveStoreConfig(config);

					// 2. Setup Sync History directly in DB
					statusRepo.saveSyncResult({
						storeId,
						storeName: `Store ${storeId}`,
						platform: "woocommerce",
						repricedCount: repriced,
						pendingCount: pending,
						unlistedCount: unlisted,
						timestamp: new Date(),
						errors: [],
					});

					// 3. Query API
					const response = await request(app).get(
						`/api/stores/${storeId}/status`,
					);

					// 4. Verify
					expect(response.status).toBe(200);
					expect(response.body.repricedCount).toBe(repriced);
					expect(response.body.pendingCount).toBe(pending);
					expect(response.body.unlistedCount).toBe(unlisted);
				},
			),
			{ numRuns: 20 },
		);
	});

	it("Property 14: Timestamp display accuracy", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc
					.string({ minLength: 5 })
					.filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)), // storeId (URL safe)
				fc.date(), // lastSync
				async (storeId, lastSyncDate) => {
					// 1. Clean
					const db = getDatabaseConnection().getDatabase();
					db.run("DELETE FROM audit_logs WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM product_status WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM sync_history WHERE store_id = ?", [storeId]);
					db.run("DELETE FROM stores WHERE id = ?", [storeId]);

					// 2. Setup Store
					const config = createStoreConfig(
						storeId,
						`Store ${storeId}`,
						"woocommerce",
						{ url: "http://test", consumerKey: "k", consumerSecret: "s" },
						60,
						true,
						process.env.ENCRYPTION_KEY,
					);
					configRepo.saveStoreConfig(config);

					// 3. Insert History
					const completedAt = lastSyncDate.toISOString();
					statusRepo.saveSyncResult({
						storeId,
						storeName: `Store ${storeId}`,
						platform: "woocommerce",
						repricedCount: 10,
						pendingCount: 5,
						unlistedCount: 0,
						timestamp: new Date(lastSyncDate),
						errors: [],
					});

					// 4. Query API
					const response = await request(app).get(
						`/api/stores/${storeId}/status`,
					);

					// 5. Verify
					expect(response.status).toBe(200);
					expect(response.body.timestamp).toBe(completedAt);
				},
			),
			{ numRuns: 20 },
		);
	});
});
