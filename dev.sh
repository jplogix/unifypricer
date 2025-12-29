#!/bin/bash

# Function to kill processes on exit
cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  if [ -n "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null
  fi
  exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start Backend
echo "🚀 Starting Backend (Port 3000)..."
bun run dev &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 2

# Start Frontend
echo "💻 Starting Frontend (Port 5173)..."
cd dashboard && bun run dev &
FRONTEND_PID=$!

# Wait for both processes
wait
