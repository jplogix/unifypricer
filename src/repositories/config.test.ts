import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	ConfigRepository,
	createStoreConfig,
	getDecryptedCredentials,
} from "./config";

describe("ConfigRepository", () => {
	let db: Database;
	let repo: ConfigRepository;
	const testEncryptionKey =
		"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
	const originalEncryptionKey = process.env.ENCRYPTION_KEY;

	beforeEach(() => {
		// Set test encryption key
		process.env.ENCRYPTION_KEY = testEncryptionKey;

		// Create in-memory database for testing
		db = new Database(":memory:");

		// Create stores table
		db.run(`
      CREATE TABLE stores (
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

		repo = new ConfigRepository(db);
	});

	afterEach(() => {
		db.close();
		// Restore original encryption key
		if (originalEncryptionKey) {
			process.env.ENCRYPTION_KEY = originalEncryptionKey;
		} else {
			delete process.env.ENCRYPTION_KEY;
		}
	});

	describe("saveStoreConfig and getStoreConfig", () => {
		test("should save and retrieve a new store configuration", () => {
			const credentials = { apiKey: "test-key", apiSecret: "test-secret" };
			const config = createStoreConfig(
				"store-1",
				"Test Store",
				"woocommerce",
				credentials,
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config);
			const retrieved = repo.getStoreConfig("store-1");

			expect(retrieved).not.toBeNull();
			expect(retrieved?.storeId).toBe("store-1");
			expect(retrieved?.storeName).toBe("Test Store");
			expect(retrieved?.platform).toBe("woocommerce");
			expect(retrieved?.syncInterval).toBe(60);
			expect(retrieved?.enabled).toBe(true);

			// Verify credentials are encrypted
			expect(retrieved?.credentials.encrypted).toBeTruthy();
			expect(retrieved?.credentials.iv).toBeTruthy();

			// Verify credentials can be decrypted
			if (retrieved) {
				const decrypted = getDecryptedCredentials(retrieved, testEncryptionKey);
				expect(decrypted.apiKey).toBe("test-key");
				expect(decrypted.apiSecret).toBe("test-secret");
			}
		});

		test("should update existing store configuration", () => {
			const credentials1 = { apiKey: "key-1" };
			const config1 = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				credentials1,
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config1);

			// Update with new credentials
			const credentials2 = { apiKey: "key-2" };
			const config2 = createStoreConfig(
				"store-1",
				"Store 1 Updated",
				"shopify",
				credentials2,
				120,
				false,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config2);

			const retrieved = repo.getStoreConfig("store-1");

			expect(retrieved?.storeName).toBe("Store 1 Updated");
			expect(retrieved?.platform).toBe("shopify");
			expect(retrieved?.syncInterval).toBe(120);
			expect(retrieved?.enabled).toBe(false);

			if (retrieved) {
				const decrypted = getDecryptedCredentials(retrieved, testEncryptionKey);
				expect(decrypted.apiKey).toBe("key-2");
			}
		});

		test("should return null for non-existent store", () => {
			const retrieved = repo.getStoreConfig("non-existent");
			expect(retrieved).toBeNull();
		});

		test("should handle complex credential objects", () => {
			const credentials = {
				apiKey: "test-key",
				apiSecret: "test-secret",
				shopDomain: "example.myshopify.com",
				accessToken: "shpat_1234567890",
				nested: {
					value: "nested-data",
				},
			};

			const config = createStoreConfig(
				"store-1",
				"Complex Store",
				"shopify",
				credentials,
				60,
				true,
				testEncryptionKey,
			);
			repo.saveStoreConfig(config);

			const retrieved = repo.getStoreConfig("store-1");

			if (retrieved) {
				const decrypted = getDecryptedCredentials(retrieved, testEncryptionKey);
				expect(decrypted.apiKey).toBe("test-key");
				expect(decrypted.apiSecret).toBe("test-secret");
				expect(decrypted.shopDomain).toBe("example.myshopify.com");
				expect(decrypted.accessToken).toBe("shpat_1234567890");
				expect(decrypted.nested.value).toBe("nested-data");
			}
		});
	});

	describe("getAllStoreConfigs", () => {
		test("should return empty array when no stores exist", () => {
			const configs = repo.getAllStoreConfigs();
			expect(configs).toEqual([]);
		});

		test("should return all store configurations", () => {
			const config1 = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{ key: "val1" },
				60,
				true,
				testEncryptionKey,
			);
			const config2 = createStoreConfig(
				"store-2",
				"Store 2",
				"shopify",
				{ key: "val2" },
				60,
				true,
				testEncryptionKey,
			);
			const config3 = createStoreConfig(
				"store-3",
				"Store 3",
				"woocommerce",
				{ key: "val3" },
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config1);
			repo.saveStoreConfig(config2);
			repo.saveStoreConfig(config3);

			const configs = repo.getAllStoreConfigs();

			expect(configs.length).toBe(3);
			expect(configs.map((c) => c.storeId).sort()).toEqual([
				"store-1",
				"store-2",
				"store-3",
			]);
		});

		test("should return stores sorted by name", () => {
			const config1 = createStoreConfig(
				"store-1",
				"Zebra Store",
				"woocommerce",
				{ key: "val1" },
				60,
				true,
				testEncryptionKey,
			);
			const config2 = createStoreConfig(
				"store-2",
				"Alpha Store",
				"shopify",
				{ key: "val2" },
				60,
				true,
				testEncryptionKey,
			);
			const config3 = createStoreConfig(
				"store-3",
				"Beta Store",
				"woocommerce",
				{ key: "val3" },
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config1);
			repo.saveStoreConfig(config2);
			repo.saveStoreConfig(config3);

			const configs = repo.getAllStoreConfigs();

			expect(configs[0].storeName).toBe("Alpha Store");
			expect(configs[1].storeName).toBe("Beta Store");
			expect(configs[2].storeName).toBe("Zebra Store");
		});

		test("should decrypt credentials for all stores", () => {
			const config1 = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{ key: "val1" },
				60,
				true,
				testEncryptionKey,
			);
			const config2 = createStoreConfig(
				"store-2",
				"Store 2",
				"shopify",
				{ key: "val2" },
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config1);
			repo.saveStoreConfig(config2);

			const configs = repo.getAllStoreConfigs();

			const decrypted1 = getDecryptedCredentials(
				configs.find((c) => c.storeId === "store-1")!,
				testEncryptionKey,
			);
			const decrypted2 = getDecryptedCredentials(
				configs.find((c) => c.storeId === "store-2")!,
				testEncryptionKey,
			);

			expect(decrypted1.key).toBe("val1");
			expect(decrypted2.key).toBe("val2");
		});
	});

	describe("deleteStoreConfig", () => {
		test("should delete existing store configuration", () => {
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{ key: "val" },
				60,
				true,
				testEncryptionKey,
			);
			repo.saveStoreConfig(config);

			expect(repo.getStoreConfig("store-1")).not.toBeNull();

			repo.deleteStoreConfig("store-1");

			expect(repo.getStoreConfig("store-1")).toBeNull();
		});

		test("should not throw error when deleting non-existent store", () => {
			expect(() => repo.deleteStoreConfig("non-existent")).not.toThrow();
		});

		test("should only delete specified store", () => {
			const config1 = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{ key: "val1" },
				60,
				true,
				testEncryptionKey,
			);
			const config2 = createStoreConfig(
				"store-2",
				"Store 2",
				"shopify",
				{ key: "val2" },
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config1);
			repo.saveStoreConfig(config2);

			repo.deleteStoreConfig("store-1");

			expect(repo.getStoreConfig("store-1")).toBeNull();
			expect(repo.getStoreConfig("store-2")).not.toBeNull();
		});
	});

	describe("createStoreConfig helper", () => {
		test("should create config with default values", () => {
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{ key: "val" },
				60,
				true,
				testEncryptionKey,
			);

			expect(config.storeId).toBe("store-1");
			expect(config.storeName).toBe("Store 1");
			expect(config.platform).toBe("woocommerce");
			expect(config.syncInterval).toBe(60);
			expect(config.enabled).toBe(true);
			expect(config.credentials.encrypted).toBeTruthy();
			expect(config.credentials.iv).toBeTruthy();
		});

		test("should create config with custom values", () => {
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"shopify",
				{ key: "val" },
				120,
				false,
				testEncryptionKey,
			);

			expect(config.syncInterval).toBe(120);
			expect(config.enabled).toBe(false);
		});

		test("should encrypt credentials", () => {
			const credentials = { apiKey: "secret-key" };
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				credentials,
				60,
				true,
				testEncryptionKey,
			);

			// Credentials should be encrypted (not plaintext)
			expect(config.credentials.encrypted).not.toContain("secret-key");

			// Should be able to decrypt
			const decrypted = getDecryptedCredentials(config, testEncryptionKey);
			expect(decrypted.apiKey).toBe("secret-key");
		});
	});

	describe("getDecryptedCredentials helper", () => {
		test("should decrypt credentials from config", () => {
			const credentials = { apiKey: "test-key", apiSecret: "test-secret" };
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				credentials,
				60,
				true,
				testEncryptionKey,
			);

			const decrypted = getDecryptedCredentials(config, testEncryptionKey);

			expect(decrypted.apiKey).toBe("test-key");
			expect(decrypted.apiSecret).toBe("test-secret");
		});

		test("should handle empty credentials object", () => {
			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				{},
				60,
				true,
				testEncryptionKey,
			);

			const decrypted = getDecryptedCredentials(config, testEncryptionKey);

			expect(decrypted).toEqual({});
		});
	});

	describe("edge cases", () => {
		test("should handle store with special characters in name", () => {
			const config = createStoreConfig(
				"store-1",
				'Store\'s "Special" Name & More',
				"woocommerce",
				{ key: "val" },
				60,
				true,
				testEncryptionKey,
			);

			repo.saveStoreConfig(config);
			const retrieved = repo.getStoreConfig("store-1");

			expect(retrieved?.storeName).toBe('Store\'s "Special" Name & More');
		});

		test("should handle credentials with special characters", () => {
			const credentials = {
				password: "p@$$w0rd!#%&*()[]{}",
				token: "abc\"def'ghi",
			};

			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				credentials,
				60,
				true,
				testEncryptionKey,
			);
			repo.saveStoreConfig(config);

			const retrieved = repo.getStoreConfig("store-1");
			if (retrieved) {
				const decrypted = getDecryptedCredentials(retrieved, testEncryptionKey);
				expect(decrypted.password).toBe("p@$$w0rd!#%&*()[]{}");
				expect(decrypted.token).toBe("abc\"def'ghi");
			}
		});

		test("should handle very long credential values", () => {
			const longValue = "a".repeat(10000);
			const credentials = { longKey: longValue };

			const config = createStoreConfig(
				"store-1",
				"Store 1",
				"woocommerce",
				credentials,
				60,
				true,
				testEncryptionKey,
			);
			repo.saveStoreConfig(config);

			const retrieved = repo.getStoreConfig("store-1");
			if (retrieved) {
				const decrypted = getDecryptedCredentials(retrieved, testEncryptionKey);
				expect(decrypted.longKey).toBe(longValue);
			}
		});
	});
});
