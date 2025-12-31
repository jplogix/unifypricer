import axios, { type AxiosError, type AxiosInstance } from "axios";
import { config } from "../config/index.js";
import type { StreetPricerProduct } from "../types/index.js";

export interface IStreetPricerClient {
	authenticate(): Promise<void>;
	fetchAllProducts(): Promise<StreetPricerProduct[]>;
	fetchProductsByCategory(category: string): Promise<StreetPricerProduct[]>;
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
		maxAttempts: 5,
		initialDelayMs: 2000,
		maxDelayMs: 30000,
		backoffMultiplier: 3,
	};

	constructor(
		private username: string = config.streetPricer.apiKey,
		private password: string = config.streetPricer.apiSecret,
		private apiUrl: string = config.streetPricer.apiUrl,
		storesEndpoint: string = config.streetPricer.storesEndpoint || "/stores",
		productsEndpoint: string = config.streetPricer.productsEndpoint ||
			"/products",
	) {
		this.storesEndpoint = storesEndpoint.startsWith("/")
			? storesEndpoint
			: `/${storesEndpoint}`;

		this.productsEndpoint = productsEndpoint.startsWith("/")
			? productsEndpoint
			: `/${productsEndpoint}`;

		this.client = axios.create({
			baseURL: this.apiUrl,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	/**
	 * Authenticate with the StreetPricer API
	 * Validates: Requirements 8.1, 8.2
	 */
	async authenticate(): Promise<void> {
		if (!this.username || !this.password) {
			const error = new Error("StreetPricer API credentials not configured");
			console.error("[StreetPricer] Authentication error:", error.message);
			throw error;
		}

		try {
			// Some StreetPricer endpoints expect form-encoded credentials (see API docs). Use URLSearchParams to be compatible.
			const params = new URLSearchParams();
			params.append("username", this.username);
			params.append("password", this.password);

			const response = await this.client.post("/auth/token", params, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			});

			this.authToken = response.data?.token;
			this.authenticated = true;

			// Set authorization header for future requests
			this.client.defaults.headers.common["Authorization"] =
				`Bearer ${this.authToken}`;

			console.log("[StreetPricer] Authentication successful");
		} catch (error) {
			this.authenticated = false;
			this.authToken = null;

			const errorMessage = this.getErrorMessage(error);
			console.error("[StreetPricer] Authentication failed:", errorMessage);

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
				const message = this.getErrorMessage(error);
				// Only fallback to legacy /products endpoint if we received a 404 indicating endpoint not present
				if (message.includes("endpoint not found") || message.includes("404")) {
					console.warn(
						"[StreetPricer] Per-store endpoint not found, falling back to products endpoint:",
						message,
					);

					return await this.fetchProductsFromEndpoint(this.productsEndpoint);
				}

				// Otherwise, surface the original error (e.g., rate limit) so caller can handle partial failures
				throw error;
			}
		});
	}

	/**
	 * Fetch products by category from StreetPricer API with retry logic
	 */
	async fetchProductsByCategory(
		category: string,
	): Promise<StreetPricerProduct[]> {
		if (!this.authenticated) {
			await this.authenticate();
		}

		return this.retryWithBackoff(async () => {
			try {
				return await this.fetchProductsFromEndpoint(this.productsEndpoint, {
					category,
				});
			} catch (error) {
				const errorMessage = this.getErrorMessage(error);
				console.error(
					`[StreetPricer] Failed to fetch products for category "${category}":`,
					errorMessage,
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
			throw new Error("No stores returned from StreetPricer");
		}

		const allProducts: StreetPricerProduct[] = [];
		const storeErrors: string[] = [];

		for (const store of stores) {
			const rawId =
				store.id ??
				store.storeId ??
				store.store_id ??
				store.EbayUserID ??
				store.SellingPartnerID;
			const storeId =
				rawId !== undefined && rawId !== null ? String(rawId).trim() : "";
			if (!storeId) {
				console.warn("[StreetPricer] Skipping store with missing id", store);
				continue;
			}

			// StreetPricer exposes per-store products under /stores/{storeId}/items (paginated)
			const endpoint = `${this.storesEndpoint.replace(/\/$/, "")}/${encodeURIComponent(storeId)}/items`;

			try {
				const storeProducts = await this.fetchProductsFromEndpoint(endpoint);
				allProducts.push(...storeProducts);
				console.log(
					`[StreetPricer] Fetched ${storeProducts.length} products from store ${storeId}`,
				);

				// Add delay between stores to avoid rate limiting
				if (stores.indexOf(store) < stores.length - 1) {
					await this.sleep(1000);
				}
			} catch (error: unknown) {
				const msg = this.getErrorMessage(error);
				console.error(
					`[StreetPricer] Failed to fetch products for store ${storeId}: ${msg}`,
				);
				storeErrors.push(`${storeId}: ${msg}`);
				// continue with other stores
				continue;
			}
		}

		console.log(
			`[StreetPricer] Aggregated ${allProducts.length} products across ${stores.length} stores`,
		);

		if (allProducts.length === 0 && storeErrors.length > 0) {
			throw new Error(
				`Per-store fetch failed for all stores: ${storeErrors.join("; ")}`,
			);
		}

		return allProducts;
	}

	/**
	 * Fetch list of StreetPricer stores
	 */
	private async fetchStores(): Promise<StreetPricerStore[]> {
		try {
			const response = await this.client.get(this.storesEndpoint);
			const data = response.data as
				| {
						stores?: StreetPricerStore[];
						items?: StreetPricerStore[];
				  }
				| StreetPricerStore[];

			// Accept multiple shapes returned by the API:
			// - An array directly: [ { ... }, ... ]
			// - Wrapped in { stores: [...] }
			// - Wrapped in { items: [...] }
			if (Array.isArray(data)) {
				return data as StreetPricerStore[];
			}

			if (Array.isArray(data?.stores)) {
				return data.stores as StreetPricerStore[];
			}

			if (Array.isArray(data?.items)) {
				return data.items as StreetPricerStore[];
			}

			return [];
		} catch (error) {
			const errorMessage = this.getErrorMessage(error);
			const endpointUrl = `${this.apiUrl.replace(/\/$/, "")}${this.storesEndpoint}`;
			console.error(
				"[StreetPricer] Failed to fetch stores:",
				`${errorMessage} (endpoint: ${endpointUrl})`,
			);
			throw error;
		}
	}

	/**
	 * Fetch products from a specific endpoint and validate/transform
	 */
	private async fetchProductsFromEndpoint(
		endpoint: string,
		params?: Record<string, unknown>,
	): Promise<StreetPricerProduct[]> {
		try {
			const aggregatedProducts: StreetPricerProduct[] = [];

			// The StreetPricer API may paginate items. Loop pages if needed.
			let page = 1;
			while (true) {
				const response = await this.client.get<unknown>(endpoint, {
					params: { ...(params || {}), page },
				});
				const data = response.data as
					| {
							items?: unknown[];
							total_page?: number;
							page?: number;
					  }
					| unknown[];
				const items = Array.isArray(data) ? data : data?.items || [];

				const validatedProducts = (items || [])
					.map((product) =>
						this.validateAndTransformProduct(
							product as Record<string, unknown>,
						),
					)
					.filter(
						(product): product is StreetPricerProduct => product !== null,
					);

				aggregatedProducts.push(...validatedProducts);

				const totalPage = Array.isArray(data)
					? null
					: typeof data?.total_page === "number"
						? data.total_page
						: null;
				const currentPage = Array.isArray(data)
					? page
					: typeof data?.page === "number"
						? data.page
						: page;

				console.log(
					`[StreetPricer] Fetched ${validatedProducts.length} valid products (${items.length} total) from ${endpoint} page=${currentPage}`,
				);

				// If paginated and more pages exist, fetch next page
				if (totalPage && currentPage < totalPage) {
					page = currentPage + 1;
					continue;
				}

				// If not paginated (no total_page), break after first fetch
				break;
			}

			console.log(
				`[StreetPricer] Aggregated ${aggregatedProducts.length} products from endpoint ${endpoint}`,
			);

			return aggregatedProducts;
		} catch (error) {
			const errorMessage = this.getErrorMessage(error);
			const endpointUrl = `${this.apiUrl.replace(/\/$/, "")}${endpoint}`;
			const isNotFound =
				axios.isAxiosError(error) && error.response?.status === 404;
			const guidance = isNotFound
				? ` (endpoint not found at ${endpointUrl}. Verify STREETPRICER_API_URL, STREETPRICER_STORES_ENDPOINT, and STREETPRICER_PRODUCTS_ENDPOINT from the StreetPricer docs).`
				: ` (endpoint: ${endpointUrl})`;

			console.error(
				"[StreetPricer] Failed to fetch products:",
				`${errorMessage}${guidance}`,
			);
			throw new Error(
				`Failed to fetch StreetPricer products: ${errorMessage}${guidance}`,
			);
		}
	}

	/**
	 * Validate product data and transform to internal format
	 * Validates: Requirement 1.4
	 */
	private validateAndTransformProduct(
		product: Record<string, unknown>,
	): StreetPricerProduct | null {
		// Flexible extraction for various API shapes (ID, id, ItemID, SKU, Price, NewPrice, Modified)
		const idRaw =
			product?.id ??
			product?.ID ??
			product?.ItemID ??
			product?.NewItemID ??
			product?.IPN;
		const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
		if (!id) {
			console.warn("[StreetPricer] Product missing or invalid id:", product);
			return null;
		}

		// Price heuristics: prefer 'price' (lowercase), fallback to 'Price' or 'NewPrice' or 'ConvertedPrice'
		const priceRaw =
			product?.price ??
			product?.Price ??
			product?.NewPrice ??
			product?.ConvertedPrice;
		const price =
			typeof priceRaw === "number"
				? priceRaw
				: typeof priceRaw === "string"
					? parseFloat(priceRaw)
					: NaN;
		if (typeof price !== "number" || Number.isNaN(price)) {
			console.warn("[StreetPricer] Product missing or invalid price:", product);
			return null;
		}

		const sku = product?.sku ?? product?.SKU ?? "";
		const name = product?.name ?? product?.Title ?? product?.ListingTitle ?? "";
		const currency = product?.currency ?? product?.PriceCurr ?? "USD";
		const lastUpdatedRaw =
			product?.last_updated ?? product?.Modified ?? product?.GTINUpdated;
		const lastUpdated = lastUpdatedRaw
			? new Date(String(lastUpdatedRaw))
			: new Date();

		return {
			id,
			sku: String(sku || ""),
			name: String(name || ""),
			price,
			currency: String(currency || "USD"),
			lastUpdated,
		};
	}

	/**
	 * Retry a function with exponential backoff
	 * Validates: Requirement 1.3
	 */
	private async retryWithBackoff<T>(
		fn: () => Promise<T>,
		attempt: number = 1,
	): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			// Check if we should retry
			if (attempt >= this.retryConfig.maxAttempts) {
				console.error(
					`[StreetPricer] Max retry attempts (${this.retryConfig.maxAttempts}) reached`,
				);
				throw error;
			}

			// Check if error is retryable
			if (!this.isRetryableError(error)) {
				console.error("[StreetPricer] Non-retryable error encountered");
				throw error;
			}

			// Calculate delay with exponential backoff
			let delay = Math.min(
				this.retryConfig.initialDelayMs *
					Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
				this.retryConfig.maxDelayMs,
			);

			// If the API returned a Retry-After header for rate limiting, respect it (in seconds)
			if (axios.isAxiosError(error) && error.response?.status === 429) {
				const retryAfter = error.response.headers?.["retry-after"];
				if (retryAfter) {
					const seconds = parseInt(String(retryAfter), 10);
					if (!Number.isNaN(seconds)) {
						delay = Math.max(delay, seconds * 1000);
					}
				} else {
					// If no Retry-After header, add extra delay for 429 errors
					delay = Math.max(delay, 5000);
				}
			}

			console.log(
				`[StreetPricer] Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`,
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
			if (axiosError.code === "ECONNABORTED") {
				return true;
			}

			// Don't retry on 4xx client errors (except 429)
			if (
				axiosError.response.status >= 400 &&
				axiosError.response.status < 500
			) {
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
				const data = axiosError.response.data as {
					message?: string;
					error?: string;
				};
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
