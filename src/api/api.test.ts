import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import app from '../index';
import { initializeDatabase, getDatabaseConnection } from '../repositories/database';

const TEST_DB_PATH = './data/test-api-integration.db';

describe('API Endpoints', () => {
    beforeAll(() => {
        process.env.DATABASE_PATH = TEST_DB_PATH;
        process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
        initializeDatabase(TEST_DB_PATH);

        const db = getDatabaseConnection().getDatabase();
        db.run('DELETE FROM audit_logs');
        db.run('DELETE FROM product_status');
        db.run('DELETE FROM sync_history');
        db.run('DELETE FROM stores');
    });

    afterAll(() => {
        const db = getDatabaseConnection().getDatabase();
        db.run('DELETE FROM audit_logs');
        db.run('DELETE FROM product_status');
        db.run('DELETE FROM sync_history');
        db.run('DELETE FROM stores');
    });

    // Basic health check
    it('GET /health should return status ok', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });

    // Store endpoints
    describe('Store Management', () => {
        const testStore = {
            storeId: 'test-store-api',
            storeName: 'Test Store API',
            platform: 'woocommerce',
            credentials: {
                url: 'http://test.com',
                consumerKey: 'key',
                consumerSecret: 'secret'
            },
            syncInterval: 60,
            enabled: true
        };

        it('POST /api/stores should create a new store', async () => {
            const response = await request(app)
                .post('/api/stores')
                .send(testStore);

            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Store created successfully');
        });

        it('GET /api/stores should list stores', async () => {
            const response = await request(app).get('/api/stores');
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            const createdStore = response.body.find((s: any) => s.storeId === testStore.storeId);
            expect(createdStore).toBeDefined();
            expect(createdStore.storeName).toBe(testStore.storeName);
        });

        it('GET /api/stores/:id/status should return 404 for unknown store', async () => {
            // Need to clean up DB first or use unique ID, but sync_history is empty for unknown
            const response = await request(app).get('/api/stores/unknown-id/status');
            expect(response.status).toBe(404);
        });
    });
});

