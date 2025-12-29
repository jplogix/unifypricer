# Implementation Plan

- [x] 1. Set up project structure and core dependencies
  - Initialize Node.js/TypeScript project with necessary dependencies (Express, Axios, SQLite, React)
  - Configure TypeScript compiler options and build scripts
  - Set up project directory structure (src/api, src/services, src/repositories, src/ui)
  - Install and configure testing frameworks (Jest, fast-check)
  - Create environment configuration for API credentials
  - _Requirements: All requirements (foundation)_

- [x] 2. Implement database schema and initialization
  - Create database initialization script with schema for stores, sync_history, and product_status tables
  - Add database indexes for performance (store_id, status, timestamps)
  - Implement database connection utility with proper error handling
  - _Requirements: 8.3, 9.3, 10.3_

- [x] 3. Implement credential encryption utility
  - Create encryption utility using AES-256-GCM for credential storage
  - Implement encrypt and decrypt functions with proper IV handling
  - Add validation for encryption key format
  - _Requirements: 8.3, 9.3, 10.3_

- [x] 3.1 Write property test for credential encryption
  - **Property 17: Credential encryption**
  - **Validates: Requirements 8.3, 9.3, 10.3**

- [x] 4. Implement Configuration Repository
  - Create ConfigRepository class with methods to manage store configurations
  - Implement getStoreConfig, getAllStoreConfigs, saveStoreConfig, deleteStoreConfig methods
  - Integrate encryption utility for credential storage and retrieval
  - _Requirements: 8.3, 9.3, 10.3_

- [x] 5. Implement StreetPricer API client
  - Create StreetPricerClient class with authentication method
  - Implement fetchAllProducts method with error handling
  - Add retry logic with exponential backoff for failed requests
  - Implement product data validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2_

- [x] 5.1 Write property test for API data retrieval
  - **Property 1: API data retrieval completeness**
  - **Validates: Requirements 1.1**

- [x] 5.2 Write property test for data parsing
  - **Property 2: Data parsing round-trip consistency**
  - **Validates: Requirements 1.2**

- [x] 5.3 Write property test for retry policy
  - **Property 3: Retry policy adherence**
  - **Validates: Requirements 1.3**

- [x] 5.4 Write property test for product validation
  - **Property 4: Product data validation**
  - **Validates: Requirements 1.4**

- [x] 5.5 Write property test for authentication
  - **Property 15: Authentication credential usage (StreetPricer)**
  - **Property 16: Authentication failure handling (StreetPricer)**
  - **Validates: Requirements 8.1, 8.2**

- [x] 6. Implement WooCommerce API client
  - Create WooCommerceClient class with authentication using consumer key/secret
  - Implement getAllProducts method to fetch products via WooCommerce REST API
  - Implement updateProductPrice method to update prices via WooCommerce REST API
  - Add error handling for authentication failures and API errors
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.2_

- [x] 6.1 Write property test for WooCommerce authentication
  - **Property 15: Authentication credential usage (WooCommerce)**
  - **Property 16: Authentication failure handling (WooCommerce)**
  - **Validates: Requirements 9.1, 9.2**

- [x] 6.2 Write property test for attribute preservation
  - **Property 12: Attribute preservation during update (WooCommerce)**
  - **Validates: Requirements 4.4**

- [x] 7. Implement Shopify API client
  - Create ShopifyClient class with authentication using access token
  - Implement getAllProducts method to fetch products and variants via Shopify REST API
  - Implement updateProductPrice method to update variant prices via Shopify REST API
  - Add error handling for authentication failures and API errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1, 10.2_

- [x] 7.1 Write property test for Shopify authentication
  - **Property 15: Authentication credential usage (Shopify)**
  - **Property 16: Authentication failure handling (Shopify)**
  - **Validates: Requirements 10.1, 10.2**

- [x] 7.2 Write property test for attribute preservation
  - **Property 12: Attribute preservation during update (Shopify)**
  - **Validates: Requirements 5.4**

- [x] 8. Implement product matching engine
  - Create ProductMatcher class with SKU-based matching algorithm
  - Implement exact SKU matching (case-sensitive)
  - Implement normalized SKU matching (case-insensitive, remove spaces/hyphens)
  - Handle products without SKU by categorizing as unlisted
  - Return match results with confidence scores
  - _Requirements: 2.1, 2.3, 3.1, 3.3_

- [x] 8.1 Write property test for SKU matching
  - **Property 5: Product matching by SKU**
  - **Validates: Requirements 2.1, 3.1**

- [x] 8.2 Write property test for unlisted categorization
  - **Property 7: Unlisted product categorization**
  - **Validates: Requirements 2.3, 3.3**

- [x] 8.3 Write property test for product count invariant
  - **Property 8: Product count invariant**
  - **Validates: Requirements 2.4, 3.4**

- [x] 9. Implement Status Repository
  - Create StatusRepository class with methods to save/retrieve sync results
  - Implement saveSyncResult, getLatestSyncStatus, getSyncHistory methods
  - Implement updateProductStatus method to track product status (repriced, pending, unlisted)
  - _Requirements: 2.2, 2.4, 3.2, 3.4, 4.2, 4.3, 5.2, 5.3_

- [x] 9.1 Write property test for mapping record creation
  - **Property 6: Mapping record creation**
  - **Validates: Requirements 2.2, 3.2**

- [x] 10. Implement sync orchestration service
  - Create SyncService class to coordinate the sync workflow
  - Implement syncStore method that orchestrates: fetch → match → update → record
  - Add logic to identify price differences and trigger updates
  - Implement error handling and partial failure recovery
  - Track sync metrics (repriced, pending, unlisted counts)
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 10.1 Write property test for price update on difference
  - **Property 9: Price update on difference detection**
  - **Validates: Requirements 4.1, 5.1**

- [x] 10.2 Write property test for successful update recording
  - **Property 10: Successful update recording**
  - **Validates: Requirements 4.2, 5.2**

- [x] 10.3 Write property test for failed update handling
  - **Property 11: Failed update handling**
  - **Validates: Requirements 4.3, 5.3**

- [x] 11. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement REST API endpoints
  - [x] Implement POST /api/sync/:storeId endpoint to trigger sync
  - [x] Implement GET /api/stores endpoint to list all stores
  - [x] Implement GET /api/stores/:storeId/status endpoint to get sync status
  - [x] Implement POST /api/stores endpoint to add new store configuration
  - [x] Add request validation and error handling middleware
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 13. Implement dashboard UI components
  - [x] Create React app structure with TypeScript
  - [x] Implement StoreCard component to display store metrics
  - [x] Implement SyncStatusIndicator component for last sync timestamp
  - [x] Implement ProductList component for detailed product status view
  - [x] Implement SyncTrigger button for manual sync
  - [x] Implement StoreConfiguration form for adding/editing stores
  - [x] Style components with Tailwind CSS
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 13.1 Write property test for dashboard count accuracy
  - **Property 13: Dashboard count accuracy**
  - **Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.3**

- [x] 13.2 Write property test for timestamp display
  - **Property 14: Timestamp display accuracy**
  - **Validates: Requirements 6.4, 7.4**

- [x] 14. Implement dashboard data fetching
  - [x] Create API client service in React app to fetch data from backend
  - [x] Implement data fetching hooks for stores and sync status
  - [x] Add loading states and error handling in UI
  - [x] Implement auto-refresh for dashboard data
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 15. Implement scheduled sync functionality
  - [x] Create scheduler service to trigger syncs based on store sync intervals
  - [x] Implement background job processing for async sync operations
  - [x] Add configuration for sync intervals per store
  - [x] Ensure only one sync runs per store at a time
  - _Requirements: All requirements (automation)_

- [x] 16. Add comprehensive error handling and logging
  - [x] Implement structured logging with different log levels
  - [x] Add error categorization (authentication, network, validation, etc.)
  - [x] Implement error recovery strategies (retry, skip, alert)
  - [x] Add audit logging for all price changes
  - _Requirements: 1.3, 4.3, 5.3, 8.2, 9.2, 10.2_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Create documentation and deployment guide
  - Write README with setup instructions and Dokploy deployment guide
  - Document API endpoints and request/response formats
  - Create configuration guide for adding stores
  - Document environment variables and security considerations
  - _Requirements: All requirements (documentation)_
