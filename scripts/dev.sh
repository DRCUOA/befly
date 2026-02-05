#!/bin/bash
# Start client + server concurrently

set -e

# Get the project root directory (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Starting development servers..."

# Start server in background
cd "$PROJECT_ROOT/server"
npm run dev &
SERVER_PID=$!

# Start client in background
cd "$PROJECT_ROOT/client"
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
