# Design Document

## Overview

This design outlines the refactoring of the Price Sync Dashboard from an Express-based Node.js application to a modern serverless architecture using Hono framework, Bun runtime, and Vercel deployment platform. The migration includes transitioning from SQLite to Nile Postgres for improved scalability and multi-tenancy support in a cloud environment.

The refactoring maintains all existing functionality while optimizing for serverless deployment patterns, improving performance through Bun's native TypeScript support, and leveraging Hono's lightweight architecture for better cold start times in Vercel's serverless functions.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Vercel Platform"
        subgraph "Frontend"
            Dashboard[React Dashboard]
        end
        
        subgraph "API Routes (/api)"
            Auth[/api/auth/*]
            Stores[/api/stores/*]
            Sync[/api/sync/*]
            Logs[/api/logs/*]
        end
        
        subgraph "Serverless Functions"
            HonoApp[Hono Application]
            Controllers[Controllers Layer]
            Services[Services Layer]
            Repositories[Repository Layer]
        end
    end
    
    subgraph "External Services"
        NileDB[(Nile Postgres)]
        StreetPricer[StreetPricer API]
        WooCommerce[WooCommerce API]
        Shopify[Shopify API]
    end
    
    Dashboard --> Auth
    Dashboard --> Stores
    Dashboard --> Sync
    Dashboard --> Logs
    
    Auth --> HonoApp
    Stores --> HonoApp
    Sync --> HonoApp
    Logs --> HonoApp
    
    HonoApp --> Controllers
    Controllers --> Services
    Services --> Repositories
    
    Repositories --> NileDB
    Services --> StreetPricer
    Services --> WooCommerce
    Services --> Shopify
```

### Framework Migration Strategy

**From Express to Hono:**
- Hono provides zero-configuration Vercel deployment
- Built on Web Standards for better serverless compatibility
- Lightweight with excellent TypeScript support
- Maintains Express-like API patterns for easier migration

**Runtime Migration:**
- Bun provides native TypeScript execution without compilation
- Built-in test runner eliminates Jest dependency
- Faster package installation and execution
- Better memory efficiency for serverless environments

### Deployment Architecture

**Vercel Serverless Functions:**
- Each API route becomes a separate serverless function
- Automatic scaling based on demand
- Cold start optimization through Hono's lightweight design
- Edge deployment for global performance

## Components and Interfaces

### Core Components

#### 1. Hono Application Router
```typescript
interface HonoApp {
  // Main application instance
  app: Hono
  
  // Route registration
  registerRoutes(): void
  
  // Middleware configuration
  configureMiddleware(): void
  
  // Error handling
  configureErrorHandling(): void
}
```

#### 2. API Route Structure
```
/api/
├── auth/
│   ├── oauth/[platform].ts     # OAuth endpoints for WooCommerce/Shopify
│   └── connect/[platform].ts   # Direct connection endpoints
├── stores/
│   ├── index.ts               # List all stores
│   ├── [storeId]/
│   │   ├── index.ts          # Store details
│   │   ├── products.ts       # Store products
│   │   └── sync.ts           # Store sync operations
├── sync/
│   ├── trigger.ts            # Manual sync trigger
│   ├── status.ts             # Sync status
│   └── stream.ts             # Real-time sync updates
└── logs/
    ├── sync.ts               # Sync operation logs
    └── server.ts             # Server logs
```

#### 3. Database Connection Manager
```typescript
interface DatabaseManager {
  // Connection pool for Nile Postgres
  pool: Pool
  
  // Tenant-aware database operations
  withTenant<T>(tenantId: string, operation: (db: Database) => Promise<T>): Promise<T>
  
  // Connection health check
  healthCheck(): Promise<boolean>
  
  // Graceful shutdown
  close(): Promise<void>
}
```

#### 4. Repository Layer Interfaces
```typescript
interface ConfigRepository {
  // Store configuration management
  getStoreConfig(storeId: string): Promise<StoreConfig | null>
  saveStoreConfig(config: StoreConfig): Promise<void>
  deleteStoreConfig(storeId: string): Promise<void>
  listStoreConfigs(): Promise<StoreConfig[]>
}

interface StatusRepository {
  // Sync status tracking
  getStoreStatus(storeId: string): Promise<StoreStatus | null>
  updateStoreStatus(status: StoreStatus): Promise<void>
  getProductStatus(storeId: string, productId: string): Promise<ProductStatus | null>
  updateProductStatus(status: ProductStatus): Promise<void>
}

interface AuditRepository {
  // Operation logging
  logSyncOperation(operation: SyncOperation): Promise<void>
  getSyncLogs(storeId: string, limit?: number): Promise<SyncOperation[]>
  logError(error: ErrorLog): Promise<void>
}
```

### Migration Components

#### 1. Database Migration Service
```typescript
interface MigrationService {
  // Schema migration from SQLite to PostgreSQL
  migrateSchema(): Promise<void>
  
  // Data migration with validation
  migrateData(): Promise<MigrationResult>
  
  // Rollback capability
  rollback(): Promise<void>
  
  // Migration status
  getStatus(): Promise<MigrationStatus>
}
```

#### 2. Configuration Adapter
```typescript
interface ConfigAdapter {
  // Environment variable mapping
  mapEnvironmentVariables(): EnvironmentConfig
  
  // Vercel-specific configuration
  getVercelConfig(): VercelConfig
  
  // Database connection configuration
  getDatabaseConfig(): DatabaseConfig
  
  // Validation
  validateConfig(): ConfigValidationResult
}
```

## Data Models

### Database Schema (PostgreSQL)

#### Store Configuration Table
```sql
CREATE TABLE store_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'woocommerce' | 'shopify'
    store_url VARCHAR(500) NOT NULL,
    credentials JSONB NOT NULL, -- Encrypted credentials
    sync_interval INTEGER DEFAULT 3600, -- seconds
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Store Status Table
```sql
CREATE TABLE store_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES store_configs(store_id),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'idle', -- 'idle' | 'syncing' | 'error'
    products_synced INTEGER DEFAULT 0,
    products_pending INTEGER DEFAULT 0,
    products_unlisted INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Product Status Table
```sql
CREATE TABLE product_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES store_configs(store_id),
    product_id VARCHAR(255) NOT NULL,
    sku VARCHAR(255),
    status VARCHAR(50) NOT NULL, -- 'synced' | 'pending' | 'unlisted' | 'error'
    last_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    UNIQUE(store_id, product_id)
);
```

#### Audit Log Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255),
    operation_type VARCHAR(100) NOT NULL,
    operation_data JSONB,
    status VARCHAR(50) NOT NULL, -- 'success' | 'error'
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### TypeScript Data Models

```typescript
interface StoreConfig {
  id: string
  storeId: string
  platform: 'woocommerce' | 'shopify'
  storeUrl: string
  credentials: EncryptedCredentials
  syncInterval: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

interface StoreStatus {
  id: string
  storeId: string
  lastSyncAt?: Date
  syncStatus: 'idle' | 'syncing' | 'error'
  productsSynced: number
  productsPending: number
  productsUnlisted: number
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

interface ProductStatus {
  id: string
  storeId: string
  productId: string
  sku?: string
  status: 'synced' | 'pending' | 'unlisted' | 'error'
  lastPrice?: number
  newPrice?: number
  lastUpdated: Date
  errorMessage?: string
}

interface SyncOperation {
  id: string
  storeId?: string
  operationType: string
  operationData: Record<string, any>
  status: 'success' | 'error'
  errorMessage?: string
  durationMs?: number
  createdAt: Date
}
```

## Error Handling

### Serverless Error Handling Strategy

#### 1. Global Error Handler
```typescript
interface ErrorHandler {
  // Centralized error processing
  handleError(error: Error, context: RequestContext): ErrorResponse
  
  // Error categorization
  categorizeError(error: Error): ErrorCategory
  
  // Logging integration
  logError(error: Error, context: RequestContext): Promise<void>
  
  // User-friendly error responses
  formatErrorResponse(error: Error): ErrorResponse
}
```

#### 2. Database Connection Error Handling
```typescript
interface DatabaseErrorHandler {
  // Connection pool exhaustion
  handlePoolExhaustion(): Promise<void>
  
  // Connection timeout
  handleConnectionTimeout(): Promise<void>
  
  // Query timeout
  handleQueryTimeout(): Promise<void>
  
  // Retry logic
  retryWithBackoff<T>(operation: () => Promise<T>): Promise<T>
}
```

#### 3. External API Error Handling
```typescript
interface APIErrorHandler {
  // Rate limiting
  handleRateLimit(platform: string): Promise<void>
  
  // Authentication errors
  handleAuthError(platform: string): Promise<void>
  
  // Network timeouts
  handleTimeout(platform: string): Promise<void>
  
  // Circuit breaker pattern
  circuitBreaker<T>(operation: () => Promise<T>): Promise<T>
}
```

### Error Categories and Responses

```typescript
enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  NETWORK = 'network',
  INTERNAL = 'internal'
}

interface ErrorResponse {
  error: {
    code: string
    message: string
    category: ErrorCategory
    details?: Record<string, any>
    timestamp: string
    requestId: string
  }
}
```

## Testing Strategy

### Testing Framework Migration

**From Jest to Bun Test:**
- Native TypeScript support without configuration
- Faster test execution
- Built-in mocking capabilities
- Compatible with existing test patterns

### Test Structure

#### 1. Unit Tests
```typescript
// Example: Repository unit test
describe('ConfigRepository', () => {
  test('should save store configuration', async () => {
    const config = createMockStoreConfig()
    await repository.saveStoreConfig(config)
    
    const saved = await repository.getStoreConfig(config.storeId)
    expect(saved).toEqual(config)
  })
})
```

#### 2. Property-Based Tests
```typescript
// Example: Database operation property test
import fc from 'fast-check'

test('store configuration round-trip property', async () => {
  await fc.assert(fc.asyncProperty(
    storeConfigArbitrary(),
    async (config) => {
      await repository.saveStoreConfig(config)
      const retrieved = await repository.getStoreConfig(config.storeId)
      expect(retrieved).toEqual(config)
    }
  ), { numRuns: 100 })
})
```

#### 3. Integration Tests
```typescript
// Example: API endpoint integration test
describe('Store API', () => {
  test('should create and retrieve store', async () => {
    const storeData = createMockStoreData()
    
    const createResponse = await app.request('/api/stores', {
      method: 'POST',
      body: JSON.stringify(storeData),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(createResponse.status).toBe(201)
    
    const storeId = (await createResponse.json()).id
    const getResponse = await app.request(`/api/stores/${storeId}`)
    
    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toMatchObject(storeData)
  })
})
```

### Test Configuration

#### Bun Test Configuration
```typescript
// bun.config.ts
export default {
  test: {
    preload: ['./src/setupTests.ts'],
    timeout: 30000,
    coverage: {
      enabled: true,
      threshold: 80
    }
  }
}
```

#### Test Database Setup
```typescript
// setupTests.ts
import { beforeAll, afterAll, beforeEach } from 'bun:test'
import { setupTestDatabase, cleanupTestDatabase } from './test-utils'

beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await cleanupTestDatabase()
})

beforeEach(async () => {
  await clearTestData()
})
```

### Testing Patterns

#### 1. Database Testing
- Use test database with isolated transactions
- Mock external API calls
- Test connection pooling behavior
- Validate data integrity

#### 2. Serverless Function Testing
- Test cold start behavior
- Validate environment variable handling
- Test timeout scenarios
- Mock Vercel runtime environment

#### 3. Migration Testing
- Test schema migration scripts
- Validate data migration accuracy
- Test rollback procedures
- Performance testing with large datasets

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- **API Equivalence Properties**: Multiple criteria (2.2, 2.5, 9.1) all test that API behavior remains identical after migration. These can be combined into a comprehensive API equivalence property.
- **Database Operation Properties**: Several criteria (5.4, 6.1, 6.3) test that database operations work correctly with PostgreSQL. These can be combined into database operation equivalence properties.
- **Test Compatibility Properties**: Multiple criteria (6.5, 9.2) test that existing tests continue to pass. These can be combined into a single test compatibility property.
- **Build and Script Properties**: Several criteria (3.3, 3.4, 8.1, 8.4) test that build and script operations work correctly. These can be combined into build system properties.

### Core Properties

#### Property 1: API Endpoint Equivalence
*For any* HTTP request to an API endpoint, the response from the Hono-based system should be functionally equivalent to the response from the original Express-based system
**Validates: Requirements 2.2, 2.5, 9.1**

#### Property 2: Database Operation Equivalence  
*For any* database operation (create, read, update, delete), the result when executed against PostgreSQL should be functionally equivalent to the result when executed against SQLite
**Validates: Requirements 5.4, 6.1, 6.3**

#### Property 3: Authentication Preservation
*For any* authentication request, the authentication behavior in the Hono system should be identical to the authentication behavior in the Express system
**Validates: Requirements 2.3**

#### Property 4: Build System Functionality
*For any* build or test command, execution with Bun should produce equivalent results to execution with the original Node.js toolchain
**Validates: Requirements 3.3, 3.4, 8.1, 8.4**

#### Property 5: Database Connection Reliability
*For any* database connection request in a serverless environment, the connection should be established successfully with proper pooling and error handling
**Validates: Requirements 5.2, 6.2**

#### Property 6: Data Migration Integrity
*For any* data record migrated from SQLite to PostgreSQL, the data structure and content should be preserved exactly
**Validates: Requirements 5.3**

#### Property 7: Transaction Consistency
*For any* database transaction, the ACID properties should be maintained in the PostgreSQL environment with proper rollback and commit behavior
**Validates: Requirements 6.4**

#### Property 8: Configuration Round-trip
*For any* configuration value, reading the value after setting it should return the same value in the Vercel environment
**Validates: Requirements 7.1, 7.2**

#### Property 9: Encryption Round-trip
*For any* data that is encrypted and then decrypted, the decrypted result should be identical to the original data in serverless environments
**Validates: Requirements 7.3**

#### Property 10: Error Message Clarity
*For any* invalid configuration, the system should provide a clear, actionable error message that identifies the specific issue
**Validates: Requirements 7.4**

#### Property 11: Development Workflow Preservation
*For any* development command (start, build, test), the workflow should function identically with Bun as it did with the original toolchain
**Validates: Requirements 8.2, 8.5**

#### Property 12: Deployment Process Reliability
*For any* deployment operation, the process should complete successfully and result in a functional application
**Validates: Requirements 8.3**

#### Property 13: Test Suite Compatibility
*For any* existing test, the test should pass with the new Bun test runner and PostgreSQL database
**Validates: Requirements 6.5, 9.2**

#### Property 14: External Integration Preservation
*For any* external API call (StreetPricer, WooCommerce, Shopify), the integration should function identically after the refactor
**Validates: Requirements 9.3**

#### Property 15: Dashboard Functionality Preservation
*For any* dashboard metric or status display, the information should be presented identically after the refactor
**Validates: Requirements 9.4**

#### Property 16: Static Asset Serving
*For any* static asset request, the asset should be served correctly in the Vercel environment
**Validates: Requirements 4.4**

### Example Test Cases

The following specific examples should be validated during implementation:

#### Git Branch Management
- Verify "vercel-deployment" branch is created and checked out
- Confirm all commits are made to the correct branch
**Validates: Requirements 1.1, 1.2, 1.3**

#### Dependency Management
- Verify Express dependencies are removed from package.json
- Confirm yarn.lock is replaced with bun.lockb
- Validate Node.js-specific dependencies are replaced with Bun alternatives
- Check SQLite dependencies and files are removed
**Validates: Requirements 2.4, 3.1, 3.5, 5.5**

#### Configuration Files
- Verify vercel.json is created with appropriate settings
- Confirm package.json scripts use Bun commands
- Validate API routes are organized in /api directory structure
**Validates: Requirements 3.2, 4.1, 4.2**

### Edge Cases

The following edge cases should be handled properly by the property-based tests:

#### Database Edge Cases
- Empty result sets from database queries
- Large datasets that test connection pooling limits
- Concurrent database operations in serverless environment
- Database connection failures and recovery

#### API Edge Cases  
- Malformed HTTP requests
- Large request/response payloads
- Concurrent API requests
- Authentication edge cases (expired tokens, invalid credentials)

#### Serverless Edge Cases
- Cold start scenarios
- Function timeout scenarios
- Memory limit scenarios
- Environment variable edge cases (missing, malformed values)