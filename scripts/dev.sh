#!/bin/bash
# Start client + server concurrently

set -e

echo "Starting development servers..."

# Start server in background
cd "$(dirname "$0")/../server"
npm run dev &
SERVER_PID=$!

# Start client in background
cd "$(dirname "$0")/../client"
npm run dev &
CLIENT_PID=$!

# Function to cleanup on exit
cleanup() {
  echo "Stopping servers..."
  kill $SERVER_PID $CLIENT_PID 2>/dev/null || true
  exit
}

trap cleanup SIGINT SIGTERM

echo "Server running on http://localhost:3005"
echo "Client running on http://localhost:5178"
echo "Press Ctrl+C to stop"

# Wait for both processes
wait
