import axios, { type AxiosError, type AxiosInstance } from "axios";
import { ShopifyProduct, ShopifyVariant } from "../types/index.js";

export interface IShopifyClient {
	authenticate(shopDomain: string, accessToken: string): Promise<void>;
	getAllProducts(): Promise<ShopifyProduct[]>;
	updateProductPrice(
		productId: number,
		variantId: number,
		price: number,
	): Promise<void>;
}

interface ShopifyApiProduct {
	id: number;
	variants: ShopifyApiVariant[];
	[key: string]: unknown; // Allow other properties
}

interface ShopifyApiVariant {
	id: number;
	sku: string | null;
	title: string;
	price: string;
	[key: string]: unknown; // Allow other properties
}

export class ShopifyClient implements IShopifyClient {
	private client: AxiosInstance | null = null;
	private authenticated: boolean = false;
	private shopDomain: string = "";
	private accessToken: string = "";

	/**
	 * Authenticate with Shopify API
	 * Validates: Requirements 10.1, 10.2
	 */
	async authenticate(shopDomain: string, accessToken: string): Promise<void> {
		if (!shopDomain || !accessToken) {
			const error = new Error("Shopify credentials not provided");
			console.error("[Shopify] Authentication error:", error.message);
			throw error;
		}

		// Normalize shop domain (remove protocol, path, .myshopify.com if present)
		const normalizedDomain = shopDomain
			.replace(/^https?:\/\//, "") // Remove http:// or https://
			.replace(/\/.*$/, "") // Remove any path
			.replace(/\.myshopify\.com$/, ""); // Remove .myshopify.com suffix

		this.shopDomain = normalizedDomain;
		this.accessToken = accessToken;

		// Create axios instance with Shopify authentication
		this.client = axios.create({
			baseURL: `https://${this.shopDomain}.myshopify.com/admin/api/2023-10`,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": this.accessToken,
			},
		});

		try {
			// Test authentication by fetching a single product
			await this.client.get("/products.json", {
				params: { limit: 1 },
			});

			this.authenticated = true;
			console.log("[Shopify] Authentication successful");
		} catch (error) {
			this.authenticated = false;
			this.client = null;

			const errorMessage = this.getErrorMessage(error);
			console.error("[Shopify] Authentication failed:", errorMessage);

			throw new Error(`Shopify authentication failed: ${errorMessage}`);
		}
	}

	/**
	 * Fetch all products from Shopify store
	 * Validates: Requirements 5.1
	 */
	async getAllProducts(): Promise<ShopifyProduct[]> {
		if (!this.authenticated || !this.client) {
			throw new Error(
				"Shopify client not authenticated. Call authenticate() first.",
			);
		}

		try {
			const allProducts: ShopifyProduct[] = [];
			let sinceId = 0;
			const limit = 250; // Shopify max per page
			let hasMore = true;

			while (hasMore) {
				const params: { limit: number; since_id?: number } = { limit };
				if (sinceId > 0) {
					params.since_id = sinceId;
				}

				const response = await this.client.get<{
					products: ShopifyApiProduct[];
				}>("/products.json", { params });

				const products = response.data.products;

				// Transform products to internal format
				const transformedProducts = products.map((product) =>
					this.transformProduct(product),
				);

				allProducts.push(...transformedProducts);

				// Check if there are more pages
				hasMore = products.length === limit;
				if (hasMore && products.length > 0) {
					sinceId = products[products.length - 1].id;
				}
			}

			console.log(`[Shopify] Fetched ${allProducts.length} products`);
			return allProducts;
		} catch (error) {
			const errorMessage = this.getErrorMessage(error);
			console.error("[Shopify] Failed to fetch products:", errorMessage);
			throw new Error(`Failed to fetch Shopify products: ${errorMessage}`);
		}
	}

	/**
	 * Update product variant price in Shopify store
	 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
	 */
	async updateProductPrice(
		productId: number,
		variantId: number,
		price: number,
	): Promise<void> {
		if (!this.authenticated || !this.client) {
			throw new Error(
				"Shopify client not authenticated. Call authenticate() first.",
			);
		}

		if (
			!productId ||
			typeof productId !== "number" ||
			productId <= 0 ||
			!Number.isInteger(productId)
		) {
			throw new Error("Invalid product ID");
		}

		if (
			!variantId ||
			typeof variantId !== "number" ||
			variantId <= 0 ||
			!Number.isInteger(variantId)
		) {
			throw new Error("Invalid variant ID");
		}

		if (
			typeof price !== "number" ||
			isNaN(price) ||
			price < 0 ||
			!isFinite(price)
		) {
			throw new Error("Invalid price value");
		}

		try {
			// Fetch current variant to preserve other attributes (Requirement 5.4)
			await this.client.get<{ variant: ShopifyApiVariant }>(
				`/variants/${variantId}.json`,
			);

			// Only update price field, preserve all other attributes
			await this.client.put(`/variants/${variantId}.json`, {
				variant: {
					id: variantId,
					price: price.toFixed(2),
				},
			});

			console.log(
				`[Shopify] Updated product ${productId} variant ${variantId} price to ${price}`,
			);
		} catch (error) {
			const errorMessage = this.getErrorMessage(error);
			console.error(
				`[Shopify] Failed to update product ${productId} variant ${variantId} price:`,
				errorMessage,
			);
			throw new Error(
				`Failed to update Shopify product price: ${errorMessage}`,
			);
		}
	}

	/**
	 * Transform Shopify API product to internal format
	 */
	private transformProduct(product: ShopifyApiProduct): ShopifyProduct {
		return {
			id: product.id,
			variants: product.variants.map((variant) =>
				this.transformVariant(variant),
			),
		};
	}

	/**
	 * Transform Shopify API variant to internal format
	 */
	private transformVariant(variant: ShopifyApiVariant): ShopifyVariant {
		return {
			id: variant.id,
			sku: variant.sku || "",
			title: variant.title || "",
			price: variant.price || "0",
		};
	}

	/**
	 * Extract error message from various error types
	 */
	private getErrorMessage(error: unknown): string {
		if (axios.isAxiosError(error)) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.data) {
				const data = axiosError.response.data as {
					message?: string;
					error?: string;
					errors?: string | string[] | Record<string, string[]>;
				};

				if (data.errors) {
					if (typeof data.errors === "string") {
						return data.errors;
					}
					if (Array.isArray(data.errors)) {
						return data.errors.join(", ");
					}
					if (typeof data.errors === "object") {
						return Object.entries(data.errors)
							.map(
								([key, values]) =>
									`${key}: ${Array.isArray(values) ? values.join(", ") : values}`,
							)
							.join("; ");
					}
				}

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
