
# Price Sync Dashboard

A comprehensive dashboard and synchronization service for updating e-commerce product prices based on competitor data (StreetPricer). Supports WooCommerce and Shopify.

## Features

- **Dashboard**: React-based UI to monitor sync status, view products, and manage store configurations.
- **Multi-Store Support**: Manage multiple WooCommerce and Shopify stores.
- **Automated Sync**: Configurable background scheduler to keep prices up-to-date automatically.
- **Manual Sync**: Trigger syncs on-demand from the dashboard.
- **Encrypted Credentials**: secure storage of API keys.
- **Status Tracking**: Detailed history of sync operations and product-level status.

## Tech Stack

- **Backend**: Bun, Express, SQLite
- **Frontend**: Vite, React, TypeScript, Tailwind CSS
- **Testing**: Bun Test, Supertest, Fastify

## Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- Node.js (for some frontend tooling compatibility if needed)

## Setup

1.  **Clone Repository**
    ```bash
    git clone <repo-url>
    cd price-sync-dashboard
    ```

2.  **Install Backend Dependencies**
    ```bash
    bun install
    ```

3.  **Environment Configuration**
    Create `.env` in the root directory:
    ```env
    PORT=3000
    NODE_ENV=development
    DATABASE_PATH=sqlite.db
    ENCRYPTION_KEY=your-32-char-secure-key-here
    STREETPRICER_API_URL=https://api.streetpricer.com/api/v1
    STREETPRICER_API_KEY=your_streetpricer_email@example.com
    STREETPRICER_API_SECRET=your_streetpricer_password
    ```
    *Note: `ENCRYPTION_KEY` must be 32 characters long (64 hex characters).*

4.  **Initialize Database**
    The application automatically initializes the SQLite database schema on startup.

5.  **Run Backend**
    ```bash
    bun run dev
    ```

6.  **Setup Frontend**
    Navigate to `dashboard/`:
    ```bash
    cd dashboard
    bun install
    bun run dev
    ```
    Access the dashboard at `http://localhost:5173`.

## Documentation

- [Deployment Guide (Dokploy/Docker)](./DEPLOYMENT.md)
- [Configuration Guide (Adding Stores)](./CONFIGURATION.md)

## API Documentation

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed store setup payload examples.

### Core Endpoints

- **GET /api/stores**: List configured stores.
- **POST /api/stores**: Add a new store.
- **GET /api/stores/:storeId/status**: view sync status.
- **POST /api/sync/:storeId**: Trigger manual sync.

## Architecture

- **Scheduler**: Runs every minute to trigger syncs based on `syncInterval`.
- **SyncService**: Coordinates fetching, matching, and updating prices.
- **Frontend**: Single Page Application (SPA) served by the backend in production.

## Troubleshooting

- **Logs**: Check console output.
- **Database**: Data is stored in `sqlite.db` (or path via `DATABASE_PATH`).
- **Tests**:
  - Backend: `bun test src`
  - Frontend: `cd dashboard && npm test`

