import axios from 'axios';
import type { StoreConfig, SyncStatus, ProductStatusRecord } from '../types';

export const API_URL = import.meta.env.MODE === 'development'
    ? 'http://localhost:3000/api'
    : '/api';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface StoreStatus {
    repricedCount: number;
    pendingCount: number;
    unlistedCount: number;
    lastSync?: string;
    completedAt?: string;
    lastStatus?: SyncStatus;
    syncStatus: SyncStatus; // standardized prop for UI
}

export const storeService = {
    getAll: async (): Promise<StoreConfig[]> => {
        const response = await api.get('/stores');
        return response.data;
    },

    create: async (config: Omit<StoreConfig, 'createdAt' | 'updatedAt'>): Promise<StoreConfig> => {
        const response = await api.post('/stores', config);
        return response.data;
    },

    // Note: Backend might not support update directly via PUT yet based on tasks.md, 
    // but usually add/edit are similar. For now we assume create handles it or we add update if needed.
    // The task list mentions "POST /api/stores endpoint to add new store configuration".
    // It doesn't explicitly mention PUT/PATCH. I'll stick to what is known or likely needed. 
    // Wait, StoreConfiguration handles both add and edit usually.

    getStatus: async (storeId: string): Promise<StoreStatus> => {
        const response = await api.get(`/stores/${storeId}/status`);
        const data = response.data;
        // Normalize the response to match what UI expects
        return {
            repricedCount: data.repricedCount,
            pendingCount: data.pendingCount,
            unlistedCount: data.unlistedCount,
            lastSync: data.completedAt, // Map completedAt to lastSync
            completedAt: data.completedAt,
            lastStatus: data.lastStatus,
            syncStatus: data.lastStatus || 'pending'
        };
    },

    getProducts: async (storeId: string): Promise<ProductStatusRecord[]> => {
        const response = await api.get(`/stores/${storeId}/products`);
        return response.data;
    },

    triggerSync: async (storeId: string): Promise<void> => {
        await api.post(`/sync/${storeId}`);
    }
};
