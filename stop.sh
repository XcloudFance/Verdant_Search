#!/bin/bash

# Verdant Search - Enhanced Stop Script
# Force kills all related processes

echo "========================================"
echo "Stopping Verdant Search Services"
echo "========================================"
echo ""

# Function to kill processes by pattern
kill_by_pattern() {
    local pattern=$1
    local name=$2
    local pids=$(ps aux | grep -E "$pattern" | grep -v grep | awk '{print $2}')
    
    if [ -n "$pids" ]; then
        echo "🔴 Killing $name processes..."
        echo "$pids" | xargs kill -9 2>/dev/null
        echo "   PIDs: $pids"
        return 0
    else
        echo "✓ No $name processes found"
        return 1
    fi
}

# Kill Python API (uvicorn, main.py, multiprocessing workers)
kill_by_pattern "uvicorn.*main:app|python.*main\.py|python.*multiprocessing.*spawn_main|python.*resource_tracker" "Python API"

# Kill Go Backend
kill_by_pattern "go run main\.go|verdant-api|go.*main\.go|/tmp/go-build.*exe/main" "Go Backend"

# Kill Frontend (vite, node)
kill_by_pattern "vite.*verdant|node.*verdant.*vite" "Frontend (Vite)"

# Kill any remaining esbuild processes
kill_by_pattern "esbuild.*verdant" "ESBuild"

# Stop PostgreSQL and Redis Docker containers
echo ""
echo "🔴 Stopping PostgreSQL..."
docker-compose down 2>/dev/null

echo "🔴 Stopping Redis..."
docker stop verdant_redis 2>/dev/null && docker rm verdant_redis 2>/dev/null || true

# Clean up PID files
echo ""
echo "🧹 Cleaning up PID files..."
rm -f logs/*.pid 2>/dev/null

# Verify all processes are stopped
echo ""
echo "========================================"
echo "Verification"
echo "========================================"

remaining=$(ps aux | grep -E "uvicorn|verdant|vite.*verdant|go.*main" | grep -v grep | grep -v "stop.sh")
if [ -z "$remaining" ]; then
    echo "✅ All services stopped successfully!"
else
    echo "⚠️  Some processes may still be running:"
    echo "$remaining"
fi

# Check ports
echo ""
echo "Port Status:"
for port in 8001 8080 5173 5432; do
    if lsof -i :$port >/dev/null 2>&1; then
        echo "  ⚠️  Port $port still in use"
    else
        echo "  ✓ Port $port free"
    fi
done

echo ""
