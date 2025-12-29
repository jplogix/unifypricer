import { describe, test, expect, beforeEach, mock } from 'bun:test';
import axios from 'axios';
import { StreetPricerClient } from './streetpricer.js';
import * as fc from 'fast-check';

// Mock axios
mock.module('axios', () => ({
  default: {
    create: mock(() => ({
      post: mock(),
      get: mock(),
      defaults: {
        headers: {
          common: {},
        },
      },
    })),
    isAxiosError: mock((error: unknown) => {
      return error && typeof error === 'object' && 'isAxiosError' in error;
    }),
  },
}));

describe('StreetPricerClient', () => {
  let client: StreetPricerClient;
  let mockAxiosInstance: {
    post: ReturnType<typeof mock>;
    get: ReturnType<typeof mock>;
    defaults: { headers: { common: Record<string, string> } };
  };

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: mock(),
      get: mock(),
      defaults: {
        headers: {
          common: {},
        },
      },
    };

    // Mock axios.create to return our mock instance
    (axios.create as ReturnType<typeof mock>).mockReturnValue(mockAxiosInstance);

    // Create client with test credentials
    client = new StreetPricerClient(
      'test-username',
      'test-password',
      'https://api.test.com'
    );
  });

  describe('authenticate', () => {
    test('should authenticate successfully with valid credentials', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'test-token-123' },
      });

      await client.authenticate();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/token', {
        username: 'test-username',
        password: 'test-password',
      });

      expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(
        'Bearer test-token-123'
      );
    });

    test('should throw error when credentials are missing', async () => {
      const clientWithoutCreds = new StreetPricerClient('', '', 'https://api.test.com');

      await expect(clientWithoutCreds.authenticate()).rejects.toThrow(
        'StreetPricer API credentials not configured'
      );
    });

    test('should throw error when authentication fails', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
        message: 'Request failed with status code 401',
      });

      (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

      await expect(client.authenticate()).rejects.toThrow(
        'StreetPricer authentication failed'
      );
    });
  });

  describe('fetchAllProducts', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'test-token-123' },
      });
    });

    test('should fetch and validate products successfully', async () => {
      const mockApiProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Product 1',
          price: 29.99,
          currency: 'USD',
          last_updated: '2024-01-01T00:00:00Z',
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          name: 'Product 2',
          price: 49.99,
          currency: 'USD',
          last_updated: '2024-01-02T00:00:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { products: mockApiProducts },
      });

      const products = await client.fetchAllProducts();

      expect(products).toHaveLength(2);
      expect(products[0]).toMatchObject({
        id: 'prod-1',
        sku: 'SKU-001',
        name: 'Product 1',
        price: 29.99,
        currency: 'USD',
      });
      expect(products[0].lastUpdated).toBeInstanceOf(Date);
    });

    test('should filter out products with missing required fields', async () => {
      const mockApiProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Valid Product',
          price: 29.99,
          currency: 'USD',
          last_updated: '2024-01-01T00:00:00Z',
        },
        {
          // Missing id
          sku: 'SKU-002',
          name: 'Invalid Product',
          price: 39.99,
          currency: 'USD',
          last_updated: '2024-01-02T00:00:00Z',
        },
        {
          id: 'prod-3',
          sku: 'SKU-003',
          name: 'Invalid Product',
          // Missing price
          currency: 'USD',
          last_updated: '2024-01-03T00:00:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { products: mockApiProducts },
      });

      const products = await client.fetchAllProducts();

      // Only the valid product should be returned
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe('prod-1');
    });

    test('should retry on network error', async () => {
      // First call fails with network error
      mockAxiosInstance.get
        .mockRejectedValueOnce({
          isAxiosError: true,
          message: 'Network Error',
          code: 'ECONNABORTED',
        })
        .mockResolvedValueOnce({
          data: {
            products: [
              {
                id: 'prod-1',
                sku: 'SKU-001',
                name: 'Product 1',
                price: 29.99,
                currency: 'USD',
                last_updated: '2024-01-01T00:00:00Z',
              },
            ],
          },
        });

      (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

      const products = await client.fetchAllProducts();

      expect(products).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    test('should retry on 500 server error', async () => {
      // First call fails with 500 error
      mockAxiosInstance.get
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: {
            status: 500,
            data: { message: 'Internal Server Error' },
          },
          message: 'Request failed with status code 500',
        })
        .mockResolvedValueOnce({
          data: {
            products: [
              {
                id: 'prod-1',
                sku: 'SKU-001',
                name: 'Product 1',
                price: 29.99,
                currency: 'USD',
                last_updated: '2024-01-01T00:00:00Z',
              },
            ],
          },
        });

      (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

      const products = await client.fetchAllProducts();

      expect(products).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    test('should not retry on 400 client error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'Bad Request' },
        },
        message: 'Request failed with status code 400',
      });

      (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

      await expect(client.fetchAllProducts()).rejects.toThrow();

      // Should only be called once (no retry)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    test('should throw after max retry attempts', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
        message: 'Request failed with status code 500',
      });

      (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

      await expect(client.fetchAllProducts()).rejects.toThrow();

      // Should be called 3 times (initial + 2 retries)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    test('should handle products with missing optional fields', async () => {
      const mockApiProducts = [
        {
          id: 'prod-1',
          // Missing sku, name, currency
          price: 29.99,
          last_updated: '2024-01-01T00:00:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { products: mockApiProducts },
      });

      const products = await client.fetchAllProducts();

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        id: 'prod-1',
        sku: '',
        name: '',
        price: 29.99,
        currency: 'USD', // Default value
      });
    });
  });

  describe('fetchProductsByCategory', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'test-token-123' },
      });
    });

    test('should fetch products by category', async () => {
      const mockApiProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Product 1',
          price: 29.99,
          currency: 'USD',
          last_updated: '2024-01-01T00:00:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { products: mockApiProducts },
      });

      const products = await client.fetchProductsByCategory('electronics');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products', {
        params: { category: 'electronics' },
      });
      expect(products).toHaveLength(1);
    });
  });

  describe('Property-Based Tests', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'test-token-123' },
      });
    });

    // Feature: price-sync-dashboard, Property 1: API data retrieval completeness
    // Validates: Requirements 1.1
    test('Property 1: For any valid StreetPricer API response containing N products, fetching all products should result in exactly N products being retrieved', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of valid API products
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              sku: fc.string(),
              name: fc.string(),
              price: fc.double({ min: 0, max: 100000, noNaN: true }),
              currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD'),
              last_updated: fc.date().map((d) => d.toISOString()),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          async (apiProducts) => {
            // Mock the API response with the generated products
            mockAxiosInstance.get.mockResolvedValueOnce({
              data: { products: apiProducts },
            });

            // Fetch products
            const products = await client.fetchAllProducts();

            // Property: The number of products retrieved should equal the number of valid products in the API response
            // All generated products are valid (have id and price), so we expect all of them back
            expect(products).toHaveLength(apiProducts.length);

            // Verify each product was properly transformed
            products.forEach((product, index) => {
              expect(product.id).toBe(apiProducts[index].id);
              expect(product.price).toBe(apiProducts[index].price);
              expect(product.sku).toBe(apiProducts[index].sku);
              expect(product.name).toBe(apiProducts[index].name);
              expect(product.currency).toBe(apiProducts[index].currency);
              expect(product.lastUpdated).toBeInstanceOf(Date);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: price-sync-dashboard, Property 2: Data parsing round-trip consistency
    // Validates: Requirements 1.2
    test('Property 2: For any valid StreetPricer API response, parsing the data and then serializing it back should preserve all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of valid API products with all required fields
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              sku: fc.string(),
              name: fc.string(),
              price: fc.double({ min: 0, max: 100000, noNaN: true }),
              currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD'),
              last_updated: fc.date().map((d) => d.toISOString()),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (originalApiProducts) => {
            // Step 1: Parse - Mock the API response and fetch products
            mockAxiosInstance.get.mockResolvedValueOnce({
              data: { products: originalApiProducts },
            });

            const parsedProducts = await client.fetchAllProducts();

            // Step 2: Serialize back to API format
            const serializedProducts = parsedProducts.map((product) => ({
              id: product.id,
              sku: product.sku,
              name: product.name,
              price: product.price,
              currency: product.currency,
              last_updated: product.lastUpdated.toISOString(),
            }));

            // Step 3: Parse again to verify round-trip consistency
            mockAxiosInstance.get.mockResolvedValueOnce({
              data: { products: serializedProducts },
            });

            const roundTripProducts = await client.fetchAllProducts();

            // Property: All required fields should be preserved after round-trip
            expect(roundTripProducts).toHaveLength(parsedProducts.length);

            roundTripProducts.forEach((roundTripProduct, index) => {
              const originalProduct = parsedProducts[index];

              // Verify required fields are preserved
              expect(roundTripProduct.id).toBe(originalProduct.id);
              expect(roundTripProduct.price).toBe(originalProduct.price);

              // Verify optional fields are preserved
              expect(roundTripProduct.sku).toBe(originalProduct.sku);
              expect(roundTripProduct.name).toBe(originalProduct.name);
              expect(roundTripProduct.currency).toBe(originalProduct.currency);

              // Verify timestamp is preserved (within 1 second tolerance for ISO string conversion)
              const timeDiff = Math.abs(
                roundTripProduct.lastUpdated.getTime() - originalProduct.lastUpdated.getTime()
              );
              expect(timeDiff).toBeLessThan(1000);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: price-sync-dashboard, Property 3: Retry policy adherence
    // Validates: Requirements 1.3
    test('Property 3: For any API request failure, the system should log the error and attempt retries according to the configured retry policy', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate different types of retryable errors
          fc.oneof(
            // Network errors (no response)
            fc.record({
              type: fc.constant('network'),
              isAxiosError: fc.constant(true),
              message: fc.string({ minLength: 1 }),
              code: fc.constantFrom('ECONNABORTED', 'ENOTFOUND', 'ECONNRESET'),
            }),
            // 5xx server errors
            fc.record({
              type: fc.constant('server'),
              isAxiosError: fc.constant(true),
              response: fc.record({
                status: fc.integer({ min: 500, max: 599 }),
                data: fc.record({
                  message: fc.string({ minLength: 1 }),
                }),
              }),
              message: fc.string({ minLength: 1 }),
            }),
            // 429 rate limit errors
            fc.record({
              type: fc.constant('ratelimit'),
              isAxiosError: fc.constant(true),
              response: fc.record({
                status: fc.constant(429),
                data: fc.record({
                  message: fc.constant('Too Many Requests'),
                }),
              }),
              message: fc.constant('Request failed with status code 429'),
            })
          ),
          // Generate number of failures before success (0 means immediate success, 1-2 means retry then succeed, 3+ means exhaust retries)
          fc.integer({ min: 0, max: 5 }),
          async (errorConfig, failureCount) => {
            // Create a new client instance for each test to avoid state pollution
            const testClient = new StreetPricerClient(
              'test-api-key',
              'test-api-secret',
              'https://api.test.com'
            );

            // Mock axios.isAxiosError to return true for our generated errors
            (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

            // Mock the sleep function to avoid actual delays during testing
            const originalSleep = (testClient as any).sleep;
            (testClient as any).sleep = mock(() => Promise.resolve());

            // Set up the mock to fail failureCount times, then succeed
            const mockCalls: Array<() => Promise<any>> = [];
            
            // Add failure calls
            for (let i = 0; i < failureCount; i++) {
              mockCalls.push(() => Promise.reject(errorConfig));
            }
            
            // Add success call
            mockCalls.push(() => Promise.resolve({
              data: {
                products: [{
                  id: 'test-product',
                  sku: 'TEST-SKU',
                  name: 'Test Product',
                  price: 29.99,
                  currency: 'USD',
                  last_updated: '2024-01-01T00:00:00Z',
                }]
              }
            }));

            // Configure the mock to return these calls in sequence
            let callIndex = 0;
            mockAxiosInstance.get.mockImplementation(() => {
              if (callIndex < mockCalls.length) {
                return mockCalls[callIndex++]();
              }
              // If we've exhausted our planned calls, return success
              return Promise.resolve({
                data: { products: [] }
              });
            });

            // Test the retry behavior
            if (failureCount >= 3) {
              // Should exhaust retries and throw error
              await expect(testClient.fetchAllProducts()).rejects.toThrow();
              
              // Property: Should attempt exactly 3 times (initial + 2 retries) for max retry policy
              expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
            } else {
              // Should eventually succeed after retries
              const products = await testClient.fetchAllProducts();
              
              // Property: Should succeed and return products
              expect(products).toBeDefined();
              
              // Property: Should make exactly failureCount + 1 calls (failures + success)
              expect(mockAxiosInstance.get).toHaveBeenCalledTimes(failureCount + 1);
            }

            // Restore original sleep function
            (testClient as any).sleep = originalSleep;

            // Reset the mock for next iteration
            mockAxiosInstance.get.mockReset();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: price-sync-dashboard, Property 4: Product data validation
    // Validates: Requirement 1.4
    test('Property 4: For any StreetPricer API response, products missing required fields (id, price) should be filtered out, and valid products should be correctly transformed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of products, some valid, some invalid
          fc.array(
            fc.oneof(
              // Valid product
              fc.record({
                id: fc.string({ minLength: 1 }),
                sku: fc.string(),
                name: fc.string(),
                price: fc.double({ noNaN: true }),
                currency: fc.string(),
                last_updated: fc.date().map((d) => d.toISOString()),
                isValid: fc.constant(true),
              }),
              // Invalid product (missing/invalid id)
              fc.record({
                id: fc.oneof(fc.constant(''), fc.constant(undefined as any), fc.integer() as any),
                sku: fc.string(),
                name: fc.string(),
                price: fc.double({ noNaN: true }),
                currency: fc.string(),
                last_updated: fc.date().map((d) => d.toISOString()),
                isValid: fc.constant(false),
              }),
              // Invalid product (missing/invalid price)
              fc.record({
                id: fc.string({ minLength: 1 }),
                sku: fc.string(),
                name: fc.string(),
                price: fc.oneof(fc.constant(NaN), fc.constant(undefined as any), fc.string() as any),
                currency: fc.string(),
                last_updated: fc.date().map((d) => d.toISOString()),
                isValid: fc.constant(false),
              })
            ),
            { minLength: 0, maxLength: 20 }
          ),
          async (mixedProducts) => {
            // Transform the generated data into what the API would return
            const apiProducts = mixedProducts.map(({ isValid, ...rest }) => rest);
            const expectedValidCount = mixedProducts.filter((p) => p.isValid).length;

            mockAxiosInstance.get.mockResolvedValueOnce({
              data: { products: apiProducts },
            });

            const products = await client.fetchAllProducts();

            // Property: Only valid products are returned
            expect(products).toHaveLength(expectedValidCount);

            // Property: Each returned product has the required fields in the correct format
            products.forEach((product) => {
              expect(product.id).toBeDefined();
              expect(typeof product.id).toBe('string');
              expect(product.id.length).toBeGreaterThan(0);
              
              expect(product.price).toBeDefined();
              expect(typeof product.price).toBe('number');
              expect(isNaN(product.price)).toBe(false);

              // Property: Transformation logic applied (e.g., date conversion)
              expect(product.lastUpdated).toBeInstanceOf(Date);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: price-sync-dashboard, Property 15: Authentication credential usage (StreetPricer)
    // Validates: Requirement 8.1
    test('Property 15: For any valid username and password, the authentication request should correctly use these credentials in the payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          async (username, password) => {
            const testClient = new StreetPricerClient(
              username,
              password,
              'https://api.test.com'
            );

            mockAxiosInstance.post.mockResolvedValueOnce({
              data: { token: 'test-token' },
            });

            await testClient.authenticate();

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/token', {
              username: username,
              password: password,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: price-sync-dashboard, Property 16: Authentication failure handling (StreetPricer)
    // Validates: Requirement 8.2
    test('Property 16: For any authentication failure response from the API, the system should correctly reset authentication state and throw an error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 499 }),
          fc.string({ minLength: 1 }),
          async (status, errorMessage) => {
            const localMockAxiosInstance = {
              post: mock(),
              get: mock(),
              defaults: {
                headers: {
                  common: {},
                },
              },
            };

            // Return the local instance for this property run
            (axios.create as ReturnType<typeof mock>).mockReturnValue(localMockAxiosInstance);
            (axios.isAxiosError as unknown as ReturnType<typeof mock>).mockReturnValue(true);

            const localClient = new StreetPricerClient(
              'test-key',
              'test-secret',
              'https://api.test.com'
            );

            localMockAxiosInstance.post.mockRejectedValueOnce({
              isAxiosError: true,
              response: {
                status,
                data: { message: errorMessage },
              },
              message: `Request failed with status code ${status}`,
            });

            // Ensure the failed authentication blocks fetching products
            const escapedError = errorMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            await expect(localClient.fetchAllProducts()).rejects.toThrow(
              new RegExp(`StreetPricer authentication failed:.*${escapedError}|${status}`)
            );
            expect(localMockAxiosInstance.get).not.toHaveBeenCalled();

            // Next attempt should re-authenticate before fetching
            localMockAxiosInstance.post.mockResolvedValueOnce({
              data: { token: 'new-token' },
            });
            localMockAxiosInstance.get.mockResolvedValueOnce({
              data: { products: [] },
            });

            await localClient.fetchAllProducts();

            expect(localMockAxiosInstance.post).toHaveBeenCalledTimes(2);
            expect(localMockAxiosInstance.get).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
