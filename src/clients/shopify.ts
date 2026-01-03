import axios, { type AxiosError, type AxiosInstance } from "axios";
import type { ShopifyProduct, ShopifyVariant } from "../types/index.js";

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
	private lastRequestTime: number = 0;
	private readonly minRequestInterval: number = 550; // 550ms = ~1.8 requests/second (safer than 500ms for 2 req/s)

	/**
	 * Rate limiting: Wait to ensure we don't exceed Shopify's rate limits
	 */
	private async waitForRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minRequestInterval) {
			const waitTime = this.minRequestInterval - timeSinceLastRequest;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Retry logic with exponential backoff for rate limit errors
	 */
	private async retryWithBackoff<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
	): Promise<T> {
		let lastError: unknown;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;

				// Check if it's a rate limit error
				const isRateLimit = this.isRateLimitError(error);

				if (!isRateLimit || attempt === maxRetries) {
					throw error;
				}

				// Exponential backoff: 1s, 2s, 4s
				const backoffTime = Math.pow(2, attempt) * 1000;
				console.warn(
					`[Shopify] Rate limit hit, retrying in ${backoffTime}ms (attempt ${attempt + 1}/${maxRetries})`,
				);
				await new Promise((resolve) => setTimeout(resolve, backoffTime));
			}
		}

		throw lastError;
	}

	/**
	 * Check if error is a rate limit error
	 */
	private isRateLimitError(error: unknown): boolean {
		if (axios.isAxiosError(error)) {
			const axiosError = error as AxiosError;
			// Check status code (429) or error message
			if (axiosError.response?.status === 429) {
				return true;
			}

			const message = this.getErrorMessage(error).toLowerCase();
			return (
				message.includes("rate limit") ||
				message.includes("exceeded") ||
				message.includes("calls per second")
			);
		}
		return false;
	}

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
			await this.waitForRateLimit();
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
	 * Fetch all products from Shopify store using cursor-based pagination
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
			const limit = 250; // Shopify max per page
			let pageInfo: string | null = null;
			let pageCount = 0;

			while (true) {
				pageCount++;
				const params: { limit: number; page_info?: string } = { limit };
				if (pageInfo) {
					params.page_info = pageInfo;
				}

				await this.waitForRateLimit();
				const response = await this.retryWithBackoff(() =>
					this.client!.get<{
						products: ShopifyApiProduct[];
					}>("/products.json", { params }),
				);

				const products = response.data.products;

				if (products.length === 0) {
					break; // No more products
				}

				// Transform products to internal format
				const transformedProducts = products.map((product) =>
					this.transformProduct(product),
				);

				allProducts.push(...transformedProducts);

				console.log(
					`[Shopify] Page ${pageCount}: Fetched ${products.length} products (${allProducts.length} total)`,
				);

				// Check for next page using Link header
				const linkHeader = response.headers["link"] || response.headers["Link"];
				if (!linkHeader) {
					// No Link header means no more pages
					break;
				}

				// Parse Link header for next page cursor
				const nextPageInfo = this.parseNextPageInfo(linkHeader);
				if (!nextPageInfo) {
					// No next page found in Link header
					break;
				}

				pageInfo = nextPageInfo;

				// Safety limit to prevent infinite loops
				if (pageCount > 1000) {
					console.warn(
						`[Shopify] Hit safety limit at page ${pageCount}, stopping pagination`,
					);
					break;
				}
			}

			console.log(
				`[Shopify] Fetched ${allProducts.length} products across ${pageCount} pages`,
			);
			return allProducts;
		} catch (error) {
			const errorMessage = this.getErrorMessage(error);
			console.error("[Shopify] Failed to fetch products:", errorMessage);
			throw new Error(`Failed to fetch Shopify products: ${errorMessage}`);
		}
	}

	/**
	 * Parse the Link header to extract the next page_info cursor
	 * Example Link header: <https://shop.myshopify.com/admin/api/2023-10/products.json?page_info=abc123&limit=250>; rel="next"
	 */
	private parseNextPageInfo(linkHeader: string): string | null {
		// Link header format: <url>; rel="next", <url>; rel="previous"
		const links = linkHeader.split(",");

		for (const link of links) {
			const parts = link.trim().split(";");
			if (parts.length !== 2) continue;

			const rel = parts[1].trim();
			if (!rel.includes('rel="next"') && !rel.includes("rel='next'")) continue;

			// Extract URL from <...>
			const urlMatch = parts[0].trim().match(/<(.+)>/);
			if (!urlMatch) continue;

			const url = urlMatch[1];

			// Extract page_info parameter
			const pageInfoMatch = url.match(/[?&]page_info=([^&]+)/);
			if (pageInfoMatch) {
				return pageInfoMatch[1];
			}
		}

		return null;
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
			Number.isNaN(price) ||
			price < 0 ||
			!Number.isFinite(price)
		) {
			throw new Error("Invalid price value");
		}

		try {
			// Fetch current variant to preserve other attributes (Requirement 5.4)
			await this.waitForRateLimit();
			await this.retryWithBackoff(() =>
				this.client!.get<{ variant: ShopifyApiVariant }>(
					`/variants/${variantId}.json`,
				),
			);

			// Only update price field, preserve all other attributes
			await this.waitForRateLimit();
			await this.retryWithBackoff(() =>
				this.client!.put(`/variants/${variantId}.json`, {
					variant: {
						id: variantId,
						price: price.toFixed(2),
					},
				}),
			);

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
				this.transformVariant(variant, product.id),
			),
		};
	}

	/**
	 * Transform Shopify API variant to internal format
	 */
	private transformVariant(
		variant: ShopifyApiVariant,
		productId: number,
	): ShopifyVariant {
		return {
			id: variant.id,
			productId: productId,
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
