export interface StoreConfig {
    storeId: string;
    storeName: string;
    platform: 'woocommerce' | 'shopify';
    syncInterval: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface StoreConfigWithCredentials {
    storeId: string;
    storeName: string;
    platform: 'woocommerce' | 'shopify';
    syncInterval: number;
    enabled: boolean;
    credentials: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
}

export type SyncStatus = 'success' | 'partial' | 'failed' | 'pending';

export interface SyncHistoryRecord {
    id: number;
    storeId: string;
    repricedCount: number;
    pendingCount: number;
    unlistedCount: number;
    status: SyncStatus;
    errorMessage?: string;
    startedAt: string;
    completedAt: string;
}

export interface ProductStatusRecord {
    id: number;
    storeId: string;
    platformProductId: string;
    streetpricerProductId: string;
    sku: string;
    status: 'repriced' | 'pending' | 'unlisted';
    lastAttempt: string;
    lastSuccess: string | null;
    errorMessage?: string;
    currentPrice?: number;
    targetPrice?: number;
}
