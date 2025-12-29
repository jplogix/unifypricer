# Technology Stack

## Runtime & Build System

- **Runtime**: Bun (primary runtime and package manager)
- **Language**: TypeScript with strict mode enabled
- **Build Target**: ESNext with bundler module resolution

## Core Dependencies

- **express**: REST API server
- **axios**: HTTP client for external API calls
- **dotenv**: Environment variable management
- **cors**: CORS middleware

## Development Tools

- **TypeScript**: Strict type checking with comprehensive compiler options
- **ESLint**: Code linting with TypeScript support
- **Bun Test**: Built-in test runner
- **fast-check**: Property-based testing library

## Common Commands

```bash
# Development
bun --watch src/index.ts          # Run with hot reload
bun run dev                        # Same as above

# Building
bun build src/index.ts --outdir dist --target bun
bun run build                      # Same as above

# Production
bun run dist/index.js              # Run compiled code
bun run start                      # Same as above

# Testing
bun test                           # Run all tests
bun test --watch                   # Run tests in watch mode

# Linting
bun run lint                       # Run ESLint
```

## TypeScript Configuration

- Strict mode enabled with all strict checks
- No unused locals or parameters allowed
- Implicit returns not allowed
- Fallthrough cases in switch statements not allowed
- Module resolution: bundler (Bun-specific)
- Target: ESNext
