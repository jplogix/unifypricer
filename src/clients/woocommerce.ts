import axios, { AxiosInstance, AxiosError } from 'axios';
import { WooCommerceProduct } from '../types/index.js';

export interface IWooCommerceClient {
  authenticate(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<void>;
  getAllProducts(): Promise<WooCommerceProduct[]>;
  updateProductPrice(productId: number, price: number): Promise<void>;
}

interface WooCommerceApiProduct {
  id: number;
  sku: string;
  name: string;
  price: string;
  regular_price: string;
  [key: string]: unknown; // Allow other properties
}

export class WooCommerceClient implements IWooCommerceClient {
  private client: AxiosInstance | null = null;
  private authenticated: boolean = false;
  private storeUrl: string = '';
  private consumerKey: string = '';
  private consumerSecret: string = '';

  /**
   * Authenticate with WooCommerce API
   * Validates: Requirements 9.1, 9.2
   */
  async authenticate(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<void> {
    if (!storeUrl || !consumerKey || !consumerSecret) {
      const error = new Error('WooCommerce credentials not provided');
      console.error('[WooCommerce] Authentication error:', error.message);
      throw error;
    }

    this.storeUrl = storeUrl.replace(/\/$/, ''); // Remove trailing slash
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;

    // Create axios instance with WooCommerce authentication
    this.client = axios.create({
      baseURL: `${this.storeUrl}/wp-json/wc/v3`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.consumerKey,
        password: this.consumerSecret,
      },
    });

    try {
      // Test authentication by fetching a single product
      await this.client.get('/products', {
        params: { per_page: 1 },
      });

      this.authenticated = true;
      console.log('[WooCommerce] Authentication successful');
    } catch (error) {
      this.authenticated = false;
      this.client = null;

      const errorMessage = this.getErrorMessage(error);
      console.error('[WooCommerce] Authentication failed:', errorMessage);

      throw new Error(`WooCommerce authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch all products from WooCommerce store
   * Validates: Requirements 4.1
   */
  async getAllProducts(): Promise<WooCommerceProduct[]> {
    if (!this.authenticated || !this.client) {
      throw new Error('WooCommerce client not authenticated. Call authenticate() first.');
    }

    try {
      const allProducts: WooCommerceProduct[] = [];
      let page = 1;
      const perPage = 100; // WooCommerce max per page
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.get<WooCommerceApiProduct[]>('/products', {
          params: {
            per_page: perPage,
            page: page,
          },
        });

        const products = response.data;

        // Transform products to internal format
        const transformedProducts = products.map((product) =>
          this.transformProduct(product)
        );

        allProducts.push(...transformedProducts);

        // Check if there are more pages
        hasMore = products.length === perPage;
        page++;
      }

      console.log(`[WooCommerce] Fetched ${allProducts.length} products`);
      return allProducts;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('[WooCommerce] Failed to fetch products:', errorMessage);
      throw new Error(`Failed to fetch WooCommerce products: ${errorMessage}`);
    }
  }

  /**
   * Update product price in WooCommerce store
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  async updateProductPrice(productId: number, price: number): Promise<void> {
    if (!this.authenticated || !this.client) {
      throw new Error('WooCommerce client not authenticated. Call authenticate() first.');
    }

    if (!productId || typeof productId !== 'number' || productId <= 0) {
      throw new Error('Invalid product ID');
    }

    if (typeof price !== 'number' || isNaN(price) || price < 0 || !isFinite(price)) {
      throw new Error('Invalid price value');
    }

    try {
      // Fetch current product to preserve other attributes (Requirement 4.4)
      await this.client.get<WooCommerceApiProduct>(
        `/products/${productId}`
      );

      // Only update price fields, preserve all other attributes
      await this.client.put(`/products/${productId}`, {
        regular_price: price.toFixed(2),
        price: price.toFixed(2),
      });

      console.log(`[WooCommerce] Updated product ${productId} price to ${price}`);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error(
        `[WooCommerce] Failed to update product ${productId} price:`,
        errorMessage
      );
      throw new Error(`Failed to update WooCommerce product price: ${errorMessage}`);
    }
  }

  /**
   * Transform WooCommerce API product to internal format
   */
  private transformProduct(product: WooCommerceApiProduct): WooCommerceProduct {
    return {
      id: product.id,
      sku: product.sku || '',
      name: product.name || '',
      price: product.price === undefined ? '0' : product.price,
      regularPrice: product.regular_price === undefined ? '0' : product.regular_price,
    };
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
}
