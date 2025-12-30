import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';
import { StreetPricerProduct } from '../types/index.js';

export interface IStreetPricerClient {
  authenticate(): Promise<void>;
  fetchAllProducts(): Promise<StreetPricerProduct[]>;
  fetchProductsByCategory(category: string): Promise<StreetPricerProduct[]>;
}

interface StreetPricerApiProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  last_updated: string;
}

interface StreetPricerStore {
  id?: string | number;
  storeId?: string | number;
  store_id?: string | number;
  name?: string;
  [key: string]: unknown;
}

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class StreetPricerClient implements IStreetPricerClient {
  private client: AxiosInstance;
  private authenticated: boolean = false;
  private authToken: string | null = null;
  private storesEndpoint: string;
  private productsEndpoint: string;
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  };

  constructor(
    private username: string = config.streetPricer.apiKey,
    private password: string = config.streetPricer.apiSecret,
    private apiUrl: string = config.streetPricer.apiUrl,
    storesEndpoint: string = config.streetPricer.storesEndpoint || '/stores',
    productsEndpoint: string = config.streetPricer.productsEndpoint || '/products'
  ) {
    this.storesEndpoint = storesEndpoint.startsWith('/')
      ? storesEndpoint
      : `/${storesEndpoint}`;

    this.productsEndpoint = productsEndpoint.startsWith('/')
      ? productsEndpoint
      : `/${productsEndpoint}`;

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with the StreetPricer API
   * Validates: Requirements 8.1, 8.2
   */
  async authenticate(): Promise<void> {
    if (!this.username || !this.password) {
      const error = new Error('StreetPricer API credentials not configured');
      console.error('[StreetPricer] Authentication error:', error.message);
      throw error;
    }

    try {
      const response = await this.client.post('/auth/token', {
        username: this.username,
        password: this.password,
      });

      this.authToken = response.data.token;
      this.authenticated = true;

      // Set authorization header for future requests
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;

      console.log('[StreetPricer] Authentication successful');
    } catch (error) {
      this.authenticated = false;
      this.authToken = null;

      const errorMessage = this.getErrorMessage(error);
      console.error('[StreetPricer] Authentication failed:', errorMessage);

      throw new Error(`StreetPricer authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch all products from StreetPricer API with retry logic
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   */
  async fetchAllProducts(): Promise<StreetPricerProduct[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    return this.retryWithBackoff(async () => {
      try {
        // Prefer fetching per-store so we aggregate both eBay stores
        return await this.fetchProductsAcrossStores();
      } catch (error) {
        // If per-store fetch fails (e.g., endpoint mismatch), fall back to legacy /products
        console.warn(
          '[StreetPricer] Per-store fetch failed, falling back to products endpoint:',
          this.getErrorMessage(error)
        );

        return await this.fetchProductsFromEndpoint(this.productsEndpoint);
      }
    });
  }

  /**
   * Fetch products by category from StreetPricer API with retry logic
   */
  async fetchProductsByCategory(category: string): Promise<StreetPricerProduct[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    return this.retryWithBackoff(async () => {
      try {
        return await this.fetchProductsFromEndpoint(this.productsEndpoint, { category });
      } catch (error) {
        const errorMessage = this.getErrorMessage(error);
        console.error(
          `[StreetPricer] Failed to fetch products for category "${category}":`,
          errorMessage
        );
        throw error;
      }
    });
  }

  /**
   * Fetch all products across all StreetPricer stores
   */
  private async fetchProductsAcrossStores(): Promise<StreetPricerProduct[]> {
    const stores = await this.fetchStores();
    if (!stores.length) {
      throw new Error('No stores returned from StreetPricer');
    }

    const allProducts: StreetPricerProduct[] = [];

    for (const store of stores) {
      const rawId = store.id ?? store.storeId ?? store.store_id;
      const storeId = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
      if (!storeId) {
        console.warn('[StreetPricer] Skipping store with missing id', store);
        continue;
      }

      const endpoint = `${this.storesEndpoint.replace(/\/$/, '')}/${encodeURIComponent(storeId)}/products`;
      const storeProducts = await this.fetchProductsFromEndpoint(endpoint);
      allProducts.push(...storeProducts);
      console.log(`[StreetPricer] Fetched ${storeProducts.length} products from store ${storeId}`);
    }

    console.log(`[StreetPricer] Aggregated ${allProducts.length} products across ${stores.length} stores`);
    return allProducts;
  }

  /**
   * Fetch list of StreetPricer stores
   */
  private async fetchStores(): Promise<StreetPricerStore[]> {
    try {
      const response = await this.client.get<{ stores: StreetPricerStore[] }>(
        this.storesEndpoint
      );
      return Array.isArray(response.data?.stores) ? response.data.stores : [];
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      const endpointUrl = `${this.apiUrl.replace(/\/$/, '')}${this.storesEndpoint}`;
      console.error(
        '[StreetPricer] Failed to fetch stores:',
        `${errorMessage} (endpoint: ${endpointUrl})`
      );
      throw error;
    }
  }

  /**
   * Fetch products from a specific endpoint and validate/transform
   */
  private async fetchProductsFromEndpoint(
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<StreetPricerProduct[]> {
    try {
      const response = await this.client.get<{ products: StreetPricerApiProduct[] }>(
        endpoint,
        { params }
      );

      const products = response.data.products || [];

      const validatedProducts = products
        .map((product) => this.validateAndTransformProduct(product))
        .filter((product): product is StreetPricerProduct => product !== null);

      console.log(
        `[StreetPricer] Fetched ${validatedProducts.length} valid products (${products.length} total) from ${endpoint}`
      );

      return validatedProducts;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      const endpointUrl = `${this.apiUrl.replace(/\/$/, '')}${endpoint}`;
      const isNotFound = axios.isAxiosError(error) && error.response?.status === 404;
      const guidance = isNotFound
        ? ` (endpoint not found at ${endpointUrl}. Verify STREETPRICER_API_URL, STREETPRICER_STORES_ENDPOINT, and STREETPRICER_PRODUCTS_ENDPOINT from the StreetPricer docs).`
        : ` (endpoint: ${endpointUrl})`;

      console.error('[StreetPricer] Failed to fetch products:', `${errorMessage}${guidance}`);
      throw new Error(`Failed to fetch StreetPricer products: ${errorMessage}${guidance}`);
    }
  }

  /**
   * Validate product data and transform to internal format
   * Validates: Requirement 1.4
   */
  private validateAndTransformProduct(
    product: StreetPricerApiProduct
  ): StreetPricerProduct | null {
    // Check required fields
    if (!product.id || typeof product.id !== 'string') {
      console.warn('[StreetPricer] Product missing or invalid id:', product);
      return null;
    }

    if (typeof product.price !== 'number' || isNaN(product.price)) {
      console.warn('[StreetPricer] Product missing or invalid price:', product);
      return null;
    }

    // Transform to internal format
    return {
      id: product.id,
      sku: product.sku || '',
      name: product.name || '',
      price: product.price,
      currency: product.currency || 'USD',
      lastUpdated: product.last_updated ? new Date(product.last_updated) : new Date(),
    };
  }

  /**
   * Retry a function with exponential backoff
   * Validates: Requirement 1.3
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Check if we should retry
      if (attempt >= this.retryConfig.maxAttempts) {
        console.error(
          `[StreetPricer] Max retry attempts (${this.retryConfig.maxAttempts}) reached`
        );
        throw error;
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        console.error('[StreetPricer] Non-retryable error encountered');
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.retryConfig.initialDelayMs *
          Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
        this.retryConfig.maxDelayMs
      );

      console.log(
        `[StreetPricer] Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`
      );

      // Wait before retrying
      await this.sleep(delay);

      // Retry
      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Retry on network errors
      if (!axiosError.response) {
        return true;
      }

      // Retry on 5xx server errors
      if (axiosError.response.status >= 500) {
        return true;
      }

      // Retry on 429 (rate limit)
      if (axiosError.response.status === 429) {
        return true;
      }

      // Retry on timeout
      if (axiosError.code === 'ECONNABORTED') {
        return true;
      }

      // Don't retry on 4xx client errors (except 429)
      if (axiosError.response.status >= 400 && axiosError.response.status < 500) {
        return false;
      }
    }

    // Retry on unknown errors
    return true;
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as { message?: string; error?: string };
        return data.message || data.error || axiosError.message;
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
