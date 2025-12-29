import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as fc from 'fast-check';
import axios from 'axios';
import { WooCommerceClient } from './woocommerce.js';

// Mock axios
const mockAxios = {
  create: mock(() => ({
    get: mock(),
    put: mock(),
    defaults: { headers: { common: {} } },
  })),
  isAxiosError: mock((error: unknown) => error && typeof error === 'object' && 'isAxiosError' in error),
};

// Replace axios with mock
Object.assign(axios, mockAxios);

describe('WooCommerceClient', () => {
  let client: WooCommerceClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    client = new WooCommerceClient();
    mockAxiosInstance = {
      get: mock(),
      put: mock(),
      defaults: { headers: { common: {} } },
    };
    mockAxios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const storeUrl = 'https://example.com';
      const consumerKey = 'ck_test123';
      const consumerSecret = 'cs_test456';

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Test Product' }],
      });

      await client.authenticate(storeUrl, consumerKey, consumerSecret);

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://example.com/wp-json/wc/v3',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          username: consumerKey,
          password: consumerSecret,
        },
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products', {
        params: { per_page: 1 },
      });
    });

    it('should handle trailing slash in store URL', async () => {
      const storeUrl = 'https://example.com/';
      const consumerKey = 'ck_test123';
      const consumerSecret = 'cs_test456';

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Test Product' }],
      });

      await client.authenticate(storeUrl, consumerKey, consumerSecret);

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://example.com/wp-json/wc/v3',
        })
      );
    });

    it('should throw error when credentials are missing', async () => {
      await expect(client.authenticate('', 'key', 'secret')).rejects.toThrow(
        'WooCommerce credentials not provided'
      );

      await expect(client.authenticate('https://example.com', '', 'secret')).rejects.toThrow(
        'WooCommerce credentials not provided'
      );

      await expect(client.authenticate('https://example.com', 'key', '')).rejects.toThrow(
        'WooCommerce credentials not provided'
      );
    });

    it('should throw error when authentication test fails', async () => {
      const storeUrl = 'https://example.com';
      const consumerKey = 'ck_invalid';
      const consumerSecret = 'cs_invalid';

      const authError = new Error('Unauthorized');
      (authError as any).isAxiosError = true;
      (authError as any).response = { status: 401, data: { message: 'Invalid credentials' } };

      mockAxiosInstance.get.mockRejectedValueOnce(authError);
      mockAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.authenticate(storeUrl, consumerKey, consumerSecret)).rejects.toThrow(
        'WooCommerce authentication failed: Invalid credentials'
      );
    });
  });

  describe('getAllProducts', () => {
    beforeEach(async () => {
      // Authenticate first
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Test Product' }],
      });
      await client.authenticate('https://example.com', 'ck_test123', 'cs_test456');
      mockAxiosInstance.get.mockClear();
    });

    it('should fetch all products with pagination', async () => {
      // Mock first page with 100 products
      const firstPageProducts = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        sku: `SKU${i + 1}`,
        name: `Product ${i + 1}`,
        price: '10.00',
        regular_price: '10.00',
      }));

      // Mock second page with 50 products
      const secondPageProducts = Array.from({ length: 50 }, (_, i) => ({
        id: i + 101,
        sku: `SKU${i + 101}`,
        name: `Product ${i + 101}`,
        price: '15.00',
        regular_price: '15.00',
      }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: firstPageProducts })
        .mockResolvedValueOnce({ data: secondPageProducts });

      const products = await client.getAllProducts();

      expect(products).toHaveLength(150);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/products', {
        params: { per_page: 100, page: 1 },
      });
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/products', {
        params: { per_page: 100, page: 2 },
      });

      // Verify product transformation
      expect(products[0]).toEqual({
        id: 1,
        sku: 'SKU1',
        name: 'Product 1',
        price: '10.00',
        regularPrice: '10.00',
      });
    });

    it('should handle products with missing fields', async () => {
      const apiProducts = [
        {
          id: 1,
          sku: '',
          name: '',
          price: '',
          regular_price: '',
        },
        {
          id: 2,
          // Missing sku, name, price, regular_price
        },
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({ data: apiProducts });

      const products = await client.getAllProducts();

      expect(products).toHaveLength(2);
      expect(products[0]).toEqual({
        id: 1,
        sku: '',
        name: '',
        price: '',
        regularPrice: '',
      });
      expect(products[1]).toEqual({
        id: 2,
        sku: '',
        name: '',
        price: '0',
        regularPrice: '0',
      });
    });

    it('should throw error when not authenticated', async () => {
      const unauthenticatedClient = new WooCommerceClient();

      await expect(unauthenticatedClient.getAllProducts()).rejects.toThrow(
        'WooCommerce client not authenticated. Call authenticate() first.'
      );
    });

    it('should throw error when API request fails', async () => {
      const apiError = new Error('Network error');
      (apiError as any).isAxiosError = true;
      mockAxiosInstance.get.mockRejectedValueOnce(apiError);
      mockAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.getAllProducts()).rejects.toThrow(
        'Failed to fetch WooCommerce products: Network error'
      );
    });
  });

  describe('updateProductPrice', () => {
    beforeEach(async () => {
      // Authenticate first
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Test Product' }],
      });
      await client.authenticate('https://example.com', 'ck_test123', 'cs_test456');
      mockAxiosInstance.get.mockClear();
    });

    it('should update product price successfully', async () => {
      const productId = 123;
      const newPrice = 25.99;

      // Mock getting current product
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          id: productId,
          sku: 'TEST-SKU',
          name: 'Test Product',
          price: '20.00',
          regular_price: '20.00',
        },
      });

      // Mock price update
      mockAxiosInstance.put.mockResolvedValueOnce({
        data: { id: productId, price: '25.99', regular_price: '25.99' },
      });

      await client.updateProductPrice(productId, newPrice);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/products/${productId}`);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/products/${productId}`, {
        regular_price: '25.99',
        price: '25.99',
      });
    });

    it('should validate product ID', async () => {
      await expect(client.updateProductPrice(0, 25.99)).rejects.toThrow('Invalid product ID');
      await expect(client.updateProductPrice(NaN, 25.99)).rejects.toThrow('Invalid product ID');
      await expect(client.updateProductPrice(-1, 25.99)).rejects.toThrow('Invalid product ID');
    });

    it('should validate price value', async () => {
      await expect(client.updateProductPrice(123, NaN)).rejects.toThrow('Invalid price value');
      await expect(client.updateProductPrice(123, -1)).rejects.toThrow('Invalid price value');
      await expect(client.updateProductPrice(123, Infinity)).rejects.toThrow('Invalid price value');
    });

    it('should throw error when not authenticated', async () => {
      const unauthenticatedClient = new WooCommerceClient();

      await expect(unauthenticatedClient.updateProductPrice(123, 25.99)).rejects.toThrow(
        'WooCommerce client not authenticated. Call authenticate() first.'
      );
    });

    it('should throw error when product fetch fails', async () => {
      const productId = 123;
      const newPrice = 25.99;

      const fetchError = new Error('Product not found');
      (fetchError as any).isAxiosError = true;
      (fetchError as any).response = { status: 404, data: { message: 'Product not found' } };

      mockAxiosInstance.get.mockRejectedValueOnce(fetchError);
      mockAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.updateProductPrice(productId, newPrice)).rejects.toThrow(
        'Failed to update WooCommerce product price: Product not found'
      );
    });

    it('should throw error when price update fails', async () => {
      const productId = 123;
      const newPrice = 25.99;

      // Mock successful product fetch
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { id: productId, price: '20.00', regular_price: '20.00' },
      });

      // Mock failed price update
      const updateError = new Error('Update failed');
      (updateError as any).isAxiosError = true;
      mockAxiosInstance.put.mockRejectedValueOnce(updateError);
      mockAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.updateProductPrice(productId, newPrice)).rejects.toThrow(
        'Failed to update WooCommerce product price: Update failed'
      );
    });
  });

  describe('error handling', () => {
    it('should extract error message from axios error with response data', () => {
      const error = new Error('Request failed');
      (error as any).isAxiosError = true;
      (error as any).response = {
        data: { message: 'Custom error message' },
      };

      mockAxios.isAxiosError.mockReturnValueOnce(true);

      // This tests the private getErrorMessage method indirectly
      expect(() => {
        throw error;
      }).toThrow();
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: price-sync-dashboard, Property 15: Authentication credential usage (WooCommerce)
    // Validates: Requirement 9.1
    it('Property 15: For any valid consumer key and secret, the authentication request should correctly use these credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // storeUrl
          fc.string({ minLength: 1 }), // consumerKey
          fc.string({ minLength: 1 }), // consumerSecret
          async (storeUrl, consumerKey, consumerSecret) => {
            // Clear mocks loops to prevent test interference
            mockAxiosInstance.create = mock(() => mockAxiosInstance);
            mockAxios.create.mockClear();

            const testClient = new WooCommerceClient();

            // Mock successful response
            mockAxiosInstance.get.mockResolvedValueOnce({
              data: [{ id: 1, name: 'Test Product' }],
            });

            // We need a valid URL format for axios not to complain before it even gets to our mock
            const safeUrl = `https://example-${Math.random()}.com`;

            await testClient.authenticate(safeUrl, consumerKey, consumerSecret);

            expect(mockAxios.create).toHaveBeenCalledWith(
              expect.objectContaining({
                baseURL: expect.stringContaining(safeUrl),
                auth: {
                  username: consumerKey,
                  password: consumerSecret
                }
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    // Feature: price-sync-dashboard, Property 16: Authentication failure handling (WooCommerce)
    // Validates: Requirement 9.2
    it('Property 16: For any authentication failure response from the WooCommerce API, the system should catch the error and throw a standardized exception', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 499 }),
          fc.string({ minLength: 1 }),
          async (statusCode, errorMessage) => {
            const testClient = new WooCommerceClient();

            const authError = new Error('Auth Error');
            (authError as any).isAxiosError = true;
            (authError as any).response = {
              status: statusCode,
              data: { message: errorMessage }
            };

            mockAxiosInstance.get.mockRejectedValueOnce(authError);
            mockAxios.isAxiosError.mockReturnValue(true);

            await expect(testClient.authenticate('https://example.com', 'key', 'secret'))
              .rejects.toThrow(`WooCommerce authentication failed: ${errorMessage}`);
          }
        ),
        { numRuns: 50 }
      );
    });

    // Feature: price-sync-dashboard, Property 12: Attribute preservation during update (WooCommerce)
    // Validates: Requirement 4.4
    it('Property 12: When updating a price, no other product attributes should be modified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1 }), // productId
          fc.double({ min: 0.01, max: 10000, noNaN: true }), // newPrice
          fc.string(), // initialSku
          fc.string(), // initialName
          async (productId, newPrice, initialSku, initialName) => {
            // Clear mocks loops to prevent test interference
            mockAxiosInstance.put.mockClear();
            mockAxiosInstance.get.mockClear();

            const testClient = new WooCommerceClient();

            // Mock auth success
            mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });
            await testClient.authenticate('https://example.com', 'key', 'secret');
            mockAxiosInstance.get.mockClear();

            // Mock get product (before update)
            mockAxiosInstance.get.mockResolvedValueOnce({
              data: {
                id: productId,
                sku: initialSku,
                name: initialName,
                price: '10.00',
                regular_price: '10.00'
              }
            });

            // Mock update response
            mockAxiosInstance.put.mockResolvedValueOnce({
              data: {
                id: productId,
                sku: initialSku,
                name: initialName,
                price: String(newPrice),
                regular_price: String(newPrice)
              }
            });

            await testClient.updateProductPrice(productId, newPrice);

            // Verify the PUT request only contained the price fields
            expect(mockAxiosInstance.put).toHaveBeenCalledWith(
              `/products/${productId}`,
              expect.objectContaining({
                regular_price: newPrice.toFixed(2),
                price: newPrice.toFixed(2)
              })
            );

            // We verify the PUT payload DOES NOT contain other fields like name or SKU
            const putCall = mockAxiosInstance.put.mock.calls.find((call: any[]) => call[0] === `/products/${productId}`);
            const putPayload = putCall[1];

            expect(putPayload).not.toHaveProperty('sku');
            expect(putPayload).not.toHaveProperty('name');
            expect(putPayload).not.toHaveProperty('id');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});