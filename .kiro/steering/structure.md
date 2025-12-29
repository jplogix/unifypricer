# Project Structure

## Directory Organization

```
src/
├── api/          # REST API routes and controllers
├── clients/      # External API clients (StreetPricer, WooCommerce, Shopify)
├── services/     # Business logic (sync orchestration, product matching)
├── repositories/ # Data access layer (database operations)
├── utils/        # Utility functions (encryption, helpers)
├── types/        # TypeScript type definitions
├── config/       # Configuration management and validation
└── index.ts      # Application entry point
```

## Architectural Patterns

### Layered Architecture

1. **API Layer** (`src/api/`): HTTP endpoints and request/response handling
2. **Service Layer** (`src/services/`): Business logic and orchestration
3. **Client Layer** (`src/clients/`): External API integrations
4. **Repository Layer** (`src/repositories/`): Database operations and data access
5. **Utilities** (`src/utils/`): Shared helper functions

### Key Principles

- **Separation of Concerns**: Each layer has a distinct responsibility
- **Dependency Direction**: Higher layers depend on lower layers (API → Services → Repositories)
- **Type Safety**: All domain types defined in `src/types/index.ts`
- **Configuration**: Centralized in `src/config/` with validation on startup

## File Naming Conventions

- Source files: `kebab-case.ts`
- Test files: `*.test.ts` (co-located with source)
- Type definitions: Centralized in `src/types/index.ts`

## Testing Strategy

- Unit tests co-located with source files
- Property-based tests using fast-check (minimum 100 iterations)
- Test files use `.test.ts` extension
- Run tests with `bun test`

## Data Storage

- SQLite database stored in `data/` directory
- Database path configurable via environment variable
- Encrypted credentials stored in database using AES-256-GCM

## Environment Configuration

- Environment variables loaded via dotenv
- Configuration validated on application startup
- Required variables: `ENCRYPTION_KEY` (64 hex characters)
- Example configuration in `.env.example`
