import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import axios from "axios";
import * as fc from "fast-check";
import { ShopifyClient } from "./shopify.js";

// Mock axios
const mockAxios = {
	create: mock(() => ({
		get: mock(),
		put: mock(),
		defaults: { headers: { common: {} } },
	})),
	isAxiosError: mock(
		(error: unknown) =>
			error && typeof error === "object" && "isAxiosError" in error,
	),
};

// Replace axios with mock
Object.assign(axios, mockAxios);

describe("ShopifyClient", () => {
	let client: ShopifyClient;
	let mockAxiosInstance: any;

	beforeEach(() => {
		client = new ShopifyClient();
		mockAxiosInstance = {
			get: mock(),
			put: mock(),
			defaults: {
				headers: {
					common: {} as Record<string, string>,
				},
			},
		};
		mockAxios.create.mockReturnValue(mockAxiosInstance);
	});

	afterEach(() => {
		mock.restore();
	});

	describe("authenticate", () => {
		it("should authenticate successfully with valid credentials", async () => {
			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: [] },
			});

			await client.authenticate("test-shop", "test-token");

			expect(mockAxios.create).toHaveBeenCalledWith({
				baseURL: "https://test-shop.myshopify.com/admin/api/2023-10",
				timeout: 30000,
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": "test-token",
				},
			});

			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/products.json", {
				params: { limit: 1 },
			});
		});

		it("should normalize shop domain by removing .myshopify.com", async () => {
			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: [] },
			});

			await client.authenticate("test-shop.myshopify.com", "test-token");

			expect(mockAxios.create).toHaveBeenCalledWith({
				baseURL: "https://test-shop.myshopify.com/admin/api/2023-10",
				timeout: 30000,
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": "test-token",
				},
			});
		});

		it("should throw error when shop domain is missing", async () => {
			await expect(client.authenticate("", "test-token")).rejects.toThrow(
				"Shopify credentials not provided",
			);
		});

		it("should throw error when access token is missing", async () => {
			await expect(client.authenticate("test-shop", "")).rejects.toThrow(
				"Shopify credentials not provided",
			);
		});

		it("should throw error when authentication test fails", async () => {
			const error = new Error("Unauthorized");
			mockAxiosInstance.get.mockRejectedValueOnce(error);

			await expect(
				client.authenticate("test-shop", "invalid-token"),
			).rejects.toThrow("Shopify authentication failed: Unauthorized");
		});
	});

	describe("getAllProducts", () => {
		beforeEach(async () => {
			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: [] },
			});
			await client.authenticate("test-shop", "test-token");
			mockAxiosInstance.get.mockClear();
		});

		it("should fetch all products successfully", async () => {
			const mockProducts = [
				{
					id: 1,
					variants: [
						{
							id: 101,
							sku: "TEST-001",
							title: "Test Variant 1",
							price: "19.99",
						},
					],
				},
				{
					id: 2,
					variants: [
						{
							id: 201,
							sku: "TEST-002",
							title: "Test Variant 2",
							price: "29.99",
						},
					],
				},
			];

			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: mockProducts },
			});

			const products = await client.getAllProducts();

			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/products.json", {
				params: { limit: 250 },
			});

			expect(products).toHaveLength(2);
			expect(products[0]).toEqual({
				id: 1,
				variants: [
					{
						id: 101,
						productId: 1,
						sku: "TEST-001",
						title: "Test Variant 1",
						price: "19.99",
					},
				],
			});
		});

		it("should handle pagination correctly", async () => {
			const firstBatch = Array.from({ length: 250 }, (_, i) => ({
				id: i + 1,
				variants: [
					{
						id: (i + 1) * 100,
						sku: `TEST-${String(i + 1).padStart(3, "0")}`,
						title: `Test Variant ${i + 1}`,
						price: "19.99",
					},
				],
			}));

			const secondBatch = [
				{
					id: 251,
					variants: [
						{
							id: 25100,
							sku: "TEST-251",
							title: "Test Variant 251",
							price: "19.99",
						},
					],
				},
			];

			mockAxiosInstance.get
				.mockResolvedValueOnce({
					data: { products: firstBatch },
				})
				.mockResolvedValueOnce({
					data: { products: secondBatch },
				});

			const products = await client.getAllProducts();

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
			expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
				1,
				"/products.json",
				{
					params: { limit: 250 },
				},
			);
			expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
				2,
				"/products.json",
				{
					params: { limit: 250, since_id: 250 },
				},
			);

			expect(products).toHaveLength(251);
		});

		it("should handle products with missing variant data", async () => {
			const mockProducts = [
				{
					id: 1,
					variants: [
						{
							id: 101,
							sku: null,
							title: "",
							price: "",
						},
					],
				},
			];

			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: mockProducts },
			});

			const products = await client.getAllProducts();

			expect(products[0].variants[0]).toEqual({
				id: 101,
				productId: 1,
				sku: "",
				title: "",
				price: "0",
			});
		});

		it("should throw error when not authenticated", async () => {
			const unauthenticatedClient = new ShopifyClient();

			await expect(unauthenticatedClient.getAllProducts()).rejects.toThrow(
				"Shopify client not authenticated. Call authenticate() first.",
			);
		});

		it("should throw error when API request fails", async () => {
			const error = new Error("Network error");
			mockAxiosInstance.get.mockRejectedValueOnce(error);

			await expect(client.getAllProducts()).rejects.toThrow(
				"Failed to fetch Shopify products: Network error",
			);
		});
	});

	describe("updateProductPrice", () => {
		beforeEach(async () => {
			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { products: [] },
			});
			await client.authenticate("test-shop", "test-token");
			mockAxiosInstance.get.mockClear();
		});

		it("should update product price successfully", async () => {
			const mockVariant = {
				id: 101,
				sku: "TEST-001",
				title: "Test Variant",
				price: "19.99",
			};

			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { variant: mockVariant },
			});
			mockAxiosInstance.put.mockResolvedValueOnce({
				data: { variant: { ...mockVariant, price: "25.99" } },
			});

			await client.updateProductPrice(1, 101, 25.99);

			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/variants/101.json");
			expect(mockAxiosInstance.put).toHaveBeenCalledWith("/variants/101.json", {
				variant: {
					id: 101,
					price: "25.99",
				},
			});
		});

		it("should validate product ID", async () => {
			await expect(client.updateProductPrice(0, 101, 25.99)).rejects.toThrow(
				"Invalid product ID",
			);
			await expect(client.updateProductPrice(-1, 101, 25.99)).rejects.toThrow(
				"Invalid product ID",
			);
			await expect(client.updateProductPrice(1.5, 101, 25.99)).rejects.toThrow(
				"Invalid product ID",
			);
		});

		it("should validate variant ID", async () => {
			await expect(client.updateProductPrice(1, 0, 25.99)).rejects.toThrow(
				"Invalid variant ID",
			);
			await expect(client.updateProductPrice(1, -1, 25.99)).rejects.toThrow(
				"Invalid variant ID",
			);
			await expect(client.updateProductPrice(1, 1.5, 25.99)).rejects.toThrow(
				"Invalid variant ID",
			);
		});

		it("should validate price value", async () => {
			await expect(client.updateProductPrice(1, 101, -1)).rejects.toThrow(
				"Invalid price value",
			);
			await expect(client.updateProductPrice(1, 101, NaN)).rejects.toThrow(
				"Invalid price value",
			);
			await expect(client.updateProductPrice(1, 101, Infinity)).rejects.toThrow(
				"Invalid price value",
			);
		});

		it("should throw error when not authenticated", async () => {
			const unauthenticatedClient = new ShopifyClient();

			await expect(
				unauthenticatedClient.updateProductPrice(1, 101, 25.99),
			).rejects.toThrow(
				"Shopify client not authenticated. Call authenticate() first.",
			);
		});

		it("should throw error when variant fetch fails", async () => {
			const error = new Error("Variant not found");
			mockAxiosInstance.get.mockRejectedValueOnce(error);

			await expect(client.updateProductPrice(1, 101, 25.99)).rejects.toThrow(
				"Failed to update Shopify product price: Variant not found",
			);
		});

		it("should throw error when price update fails", async () => {
			const mockVariant = {
				id: 101,
				sku: "TEST-001",
				title: "Test Variant",
				price: "19.99",
			};

			mockAxiosInstance.get.mockResolvedValueOnce({
				data: { variant: mockVariant },
			});

			const error = new Error("Update failed");
			mockAxiosInstance.put.mockRejectedValueOnce(error);

			await expect(client.updateProductPrice(1, 101, 25.99)).rejects.toThrow(
				"Failed to update Shopify product price: Update failed",
			);
		});
	});

	describe("error handling", () => {
		it("should handle Shopify API error responses", async () => {
			const axiosError = {
				isAxiosError: true,
				response: {
					data: {
						errors: {
							price: ["must be greater than 0"],
							sku: ["has already been taken"],
						},
					},
				},
				message: "Request failed",
			};

			mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

			await expect(
				client.authenticate("test-shop", "invalid-token"),
			).rejects.toThrow(
				"Shopify authentication failed: price: must be greater than 0; sku: has already been taken",
			);
		});

		it("should handle string error responses", async () => {
			const axiosError = {
				isAxiosError: true,
				response: {
					data: {
						errors: "Invalid request",
					},
				},
				message: "Request failed",
			};

			mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

			await expect(
				client.authenticate("test-shop", "invalid-token"),
			).rejects.toThrow("Shopify authentication failed: Invalid request");
		});

		it("should handle array error responses", async () => {
			const axiosError = {
				isAxiosError: true,
				response: {
					data: {
						errors: ["Error 1", "Error 2"],
					},
				},
				message: "Request failed",
			};

			mockAxiosInstance.get.mockRejectedValueOnce(axiosError);

			await expect(
				client.authenticate("test-shop", "invalid-token"),
			).rejects.toThrow("Shopify authentication failed: Error 1, Error 2");
		});
	});

	describe("Property-Based Tests", () => {
		// Feature: price-sync-dashboard, Property 15: Authentication credential usage (Shopify)
		// Validates: Requirement 10.1
		it("Property 15: For any valid shop domain and access token, the authentication request should correctly use these credentials", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.string({ minLength: 1 }), // shopDomain
					fc.string({ minLength: 1 }), // accessToken
					async (shopDomain, accessToken) => {
						// Clear mocks loops to prevent test interference
						mockAxiosInstance.create = mock(() => mockAxiosInstance);
						mockAxios.create.mockClear();
						mockAxios.create.mockReturnValue(mockAxiosInstance);
						mockAxiosInstance.get.mockClear();

						const testClient = new ShopifyClient();

						// Mock successful response
						mockAxiosInstance.get.mockResolvedValueOnce({
							data: { products: [] },
						});

						// Ensure domain is safe for URL (simple mocking of it processing)
						const cleanDomain = shopDomain.replace(/[^a-zA-Z0-9-.]/g, "");
						if (!cleanDomain) return;

						await testClient.authenticate(shopDomain, accessToken);

						// Normalize expected domain if it ends with .myshopify.com
						let expectedDomain = shopDomain;
						if (expectedDomain.endsWith(".myshopify.com")) {
							expectedDomain = expectedDomain.replace(".myshopify.com", "");
						}

						expect(mockAxios.create).toHaveBeenCalledWith(
							expect.objectContaining({
								baseURL: expect.stringContaining(expectedDomain),
								headers: expect.objectContaining({
									"X-Shopify-Access-Token": accessToken,
								}),
							}),
						);
					},
				),
				{ numRuns: 50 },
			);
		});

		// Feature: price-sync-dashboard, Property 16: Authentication failure handling (Shopify)
		// Validates: Requirement 10.2
		it("Property 16: For any authentication failure response from the Shopify API, the system should catch the error and throw a standardized exception", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.string({ minLength: 1 }), // errorMessage
					async (errorMessage) => {
						// Clear mocks
						mockAxiosInstance.get.mockClear();

						const testClient = new ShopifyClient();

						const authError = {
							isAxiosError: true,
							response: {
								data: { errors: errorMessage },
							},
							message: "Request failed",
						};

						mockAxiosInstance.get.mockRejectedValueOnce(authError);

						await expect(
							testClient.authenticate("test-shop", "token"),
						).rejects.toThrow();
					},
				),
				{ numRuns: 50 },
			);
		});

		// Feature: price-sync-dashboard, Property 12: Attribute preservation during update (Shopify)
		// Validates: Requirement 5.4
		it("Property 12: When updating a price, no other product attributes should be modified", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.integer({ min: 1 }), // productId
					fc.integer({ min: 1 }), // variantId
					fc.double({ min: 0.01, max: 10000, noNaN: true }), // newPrice
					fc.string(), // initialSku
					fc.string(), // initialTitle
					async (productId, variantId, newPrice, initialSku, initialTitle) => {
						// Clear mocks loops to prevent test interference
						mockAxiosInstance.put.mockClear();
						mockAxiosInstance.get.mockClear();

						const testClient = new ShopifyClient();

						// Mock auth success
						mockAxiosInstance.get.mockResolvedValueOnce({
							data: { products: [] },
						});
						await testClient.authenticate("test-shop", "token");
						mockAxiosInstance.get.mockClear();

						// Mock get variant (before update)
						mockAxiosInstance.get.mockResolvedValueOnce({
							data: {
								variant: {
									id: variantId,
									sku: initialSku,
									title: initialTitle,
									price: "10.00",
								},
							},
						});

						// Mock update response
						mockAxiosInstance.put.mockResolvedValueOnce({
							data: {
								variant: {
									id: variantId,
									sku: initialSku,
									title: initialTitle,
									price: String(newPrice),
								},
							},
						});

						await testClient.updateProductPrice(productId, variantId, newPrice);

						expect(mockAxiosInstance.put).toHaveBeenCalledWith(
							`/variants/${variantId}.json`,
							expect.objectContaining({
								variant: expect.objectContaining({
									id: variantId,
									price: newPrice.toFixed(2),
								}),
							}),
						);

						// We verify the PUT payload DOES NOT contain other fields like title or SKU
						const putCallCall = mockAxiosInstance.put.mock.calls.find(
							(call: any[]) => call[0] === `/variants/${variantId}.json`,
						);
						if (!putCallCall) throw new Error("Put Call Not Found");

						const putPayload = putCallCall[1].variant;

						expect(putPayload).not.toHaveProperty("sku");
						expect(putPayload).not.toHaveProperty("title");

						// It should have ID and Price
						expect(putPayload).toHaveProperty("id");
						expect(putPayload).toHaveProperty("price");
					},
				),
				{ numRuns: 50 },
			);
		});
	});
});
