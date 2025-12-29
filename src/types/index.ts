// Core domain types
export type Platform = 'woocommerce' | 'shopify';
export type SyncStatus = 'success' | 'partial' | 'failed';
export type ProductSyncStatus = 'repriced' | 'pending' | 'unlisted';

export enum ErrorType {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  VALIDATION = 'validation',
  API_LIMIT = 'api_limit',
  INTERNAL = 'internal',
  CONFIGURATION = 'configuration'
}

// StreetPricer types
export interface StreetPricerProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  lastUpdated: Date;
}

// WooCommerce types
export interface WooCommerceProduct {
  id: number;
  sku: string;
  name: string;
  price: string;
  regularPrice: string;
}

// Shopify types
export interface ShopifyProduct {
  id: number;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: number;
  sku: string;
  title: string;
  price: string;
}

// Product matching types
export interface ProductMatch {
  streetPricerProduct: StreetPricerProduct;
  platformProduct: WooCommerceProduct | ShopifyVariant;
  matchConfidence: number;
}

export interface ProductMatchResult {
  matched: ProductMatch[];
  unlisted: StreetPricerProduct[];
}

// Store configuration types
export interface StoreConfig {
  storeId: string;
  storeName: string;
  platform: Platform;
  credentials: EncryptedCredentials;
  syncInterval: number;
  enabled: boolean;
}

export interface EncryptedCredentials {
  encrypted: string;
  iv: string;
}

// Sync result types
export interface SyncError {
  productId: string;
  errorMessage: string;
  errorType: ErrorType;
}

export interface StoreSyncResult {
  storeId: string;
  storeName: string;
  platform: Platform;
  repricedCount: number;
  pendingCount: number;
  unlistedCount: number;
  errors: SyncError[];
  timestamp: Date;
}

export interface SyncResult {
  stores: StoreSyncResult[];
  startTime: Date;
  endTime: Date;
  overallStatus: SyncStatus;
}

// Product status types
export interface ProductStatus {
  productId: string;
  status: ProductSyncStatus;
  lastAttempt: Date;
  lastSuccess: Date | null;
  errorMessage: string | null;
}

// Database record types
export interface Store {
  id: string;
  name: string;
  platform: Platform;
  syncInterval: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncHistoryRecord {
  id: number;
  storeId: string;
  repricedCount: number;
  pendingCount: number;
  unlistedCount: number;
  status: SyncStatus;
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface ProductStatusRecord {
  id: number;
  storeId: string;
  platformProductId: string;
  streetpricerProductId: string;
  sku: string;
  status: ProductSyncStatus;
  lastAttempt: Date;
  lastSuccess?: Date;
  errorMessage?: string;
  currentPrice: number;
  targetPrice: number;
}
