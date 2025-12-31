# Testing Server Logs Feature

## Quick Start

### 1. Start the Backend Server

```bash
cd /Volumes/MAC-160/code-ext/streetapi
yarn build
yarn start
```

The server will start on port 3000 and begin intercepting console logs.

### 2. Start the Frontend (Development Mode)

```bash
cd /Volumes/MAC-160/code-ext/streetapi/dashboard
yarn dev
```

The dashboard will open on port 5173 (or the next available port).

### 3. View Server Logs

1. Open the dashboard in your browser (<http://localhost:5173>)
2. Look for the "Server Logs" collapsible panel at the top
3. Click on it to expand
4. You should see:
   - "Live" indicator with a green pulsing dot
   - Real-time logs from the server
   - Pagination controls at the bottom

## Testing the SSE Connection Manually

### Test 1: cURL Test

```bash
# This should stream logs in real-time
curl -N http://localhost:3000/api/logs/stream
```

You should see:

- Initial `:ok` heartbeat
- Recent logs formatted as SSE events
- New logs as they occur

### Test 2: REST Endpoint Test

```bash
# Get recent logs via REST
curl http://localhost:3000/api/logs

# Get recent ERROR logs only
curl http://localhost:3000/api/logs?level=ERROR&limit=50
```

### Test 3: Generate Test Logs

While the server is running, trigger some actions:

```bash
# Trigger a sync (generates logs)
curl -X POST http://localhost:3000/api/sync/test-store-id

# Or just call any endpoint to generate logs
curl http://localhost:3000/health
```

## Troubleshooting

### "Connecting to server..." stuck

1. **Check if backend is running:**

   ```bash
   curl http://localhost:3000/health
   ```

2. **Check CORS:**
   The server should have CORS enabled. Check the response headers:

   ```bash
   curl -I http://localhost:3000/api/logs/stream
   ```

3. **Check browser console:**
   Open DevTools > Console and look for any errors

4. **Verify environment variable:**
   The frontend uses `VITE_API_URL` to connect. Check:
   - `dashboard/.env.local` exists with `VITE_API_URL=http://localhost:3000`
   - Restart the Vite dev server after changing env files

### No logs appearing

1. **Check if logs are being captured:**

   ```bash
   curl http://localhost:3000/api/logs
   ```

   Should return a JSON array of recent logs

2. **Generate some logs:**
   Any server activity should generate logs. Try accessing various endpoints.

3. **Check the browser Network tab:**
   - Look for the request to `/api/logs/stream`
   - It should be in "pending" state (EventStream)
   - Check if data is being received

## Architecture

### Backend (Express + SSE)

- **Logs Controller** (`src/api/logs-controller.ts`):
  - Intercepts `console.log/error/warn/debug`
  - Stores last 1000 logs in memory
  - Broadcasts to connected SSE clients
  
- **Route** (`src/api/logs-routes.ts`):
  - `GET /api/logs/stream` - SSE endpoint
  - `GET /api/logs` - REST endpoint for historical logs
  - `DELETE /api/logs` - Clear logs

### Frontend (React + EventSource)

- **Component** (`dashboard/src/components/ServerLogs.tsx`):
  - Collapsible panel
  - Auto-connects when expanded
  - Pagination (25/50/100/200 per page)
  - Auto-scrolls to latest logs
  - Color-coded log levels

## Features

✅ Real-time log streaming via SSE
✅ Pagination for large log volumes
✅ Color-coded log levels (INFO, WARN, ERROR, DEBUG)
✅ Automatic reconnection handling
✅ Heartbeat to keep connection alive
✅ Context and metadata display
✅ Collapsible to save screen space
✅ Clear logs button
✅ Shows connection status

## Known Limitations

- Logs are stored in memory only (cleared on server restart)
- Max 1000 logs kept in buffer
- No log persistence to disk
- No log filtering by context/level in UI (yet)
