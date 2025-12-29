# Deployment Guide

This guide describes how to deploy the Price Sync Dashboard using [Dokploy](https://dokploy.com/), but the principles apply to any Docker-based deployment platform (Portainer, Coolify, etc.).

## Prerequisites

- A VPS with Dokploy installed.
- Access to your Git repository (GitHub/GitLab/etc.).

## Deployment Steps

### 1. Prepare Environment Variables

You will need the following environment variables ready:

```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=/app/data/price-sync.db
ENCRYPTION_KEY= <Generate a 32-byte hex string (64 chars)>
STREETPRICER_API_URL=https://api.streetpricer.com/api/v1
STREETPRICER_API_KEY=your_key
STREETPRICER_API_SECRET=your_secret
```

**To generate an encryption key:**
```bash
openssl rand -hex 32
```

### 2. Configure Dokploy

1.  **Create Application**:
    - Project: Select or create a project.
    - Name: `price-sync-dashboard`
    - Repository: Select your repository.
    - Branch: `main` (or your target branch).

2.  **Build Configuration**:
    - **Build Type**: `Dockerfile`
    - **Dockerfile Path**: `./Dockerfile` (default)
    - **Context Path**: `/` (default)

3.  **Environment Variables**:
    - Go to the **Environment** tab.
    - Add the variables listed in Step 1.

4.  **Volumes (Persistence)**:
    - This application uses SQLite, so you **must** persist the data directory to avoid data loss on redeployment.
    - Go to the **Volumes** tab (or "Mounts" depending on version).
    - **Mount Path**: `/app/data`
    - **Type**: Bind Mount or Volume (Volume recommended).
    - Example: Mount a volume named `price-sync-data` to `/app/data`.

5.  **Deploy**:
    - Click **Deploy**.
    - Watch the logs to ensure the build completes (it will build the frontend React app and then the backend).

### 3. Verification

Once deployed, access your application URL.
- You should see the dashboard login/main screen.
- Go to `/api/health` to verify the backend status.

## Alternative: Docker Compose

If you prefer to run locally or via `docker-compose`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ENCRYPTION_KEY=change_this_to_32_bytes_hex_string_64_chars_len
      - STREETPRICER_API_KEY=...
      - STREETPRICER_API_SECRET=...
    volumes:
      - ./data:/app/data
```
