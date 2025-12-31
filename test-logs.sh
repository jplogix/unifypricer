#!/bin/bash

echo "Testing logs API endpoint..."
echo ""
echo "Starting server in background..."
node dist/index.js &
SERVER_PID=$!

sleep 3

echo ""
echo "Testing SSE stream (will show logs for 5 seconds)..."
timeout 5 curl -N http://localhost:3000/api/logs/stream || true

echo ""
echo ""
echo "Testing REST endpoint..."
curl -s http://localhost:3000/api/logs | jq

echo ""
echo "Killing server..."
kill $SERVER_PID

echo "Done!"
