#!/bin/bash

# Verdant Search - Quick Start Script
# This script starts all services in the correct order

set -e  # Exit on error

echo "======================================"
echo "Verdant Search - Starting Services"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Step 1: Start PostgreSQL
echo -e "${YELLOW}[1/4] Starting PostgreSQL...${NC}"
docker-compose up -d
echo "Waiting for PostgreSQL to be ready..."
sleep 5
echo -e "${GREEN}✓ PostgreSQL started${NC}"
echo ""

# Step 2: Start Python API
echo -e "${YELLOW}[2/4] Starting Python Search API...${NC}"
echo "Note: This will take a while on first run (downloading CLIP model ~500MB)"
cd backend/python

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate venv and install dependencies
source venv/bin/activate
echo "Installing Python dependencies..."
pip install -q -r requirements.txt

# Start Python API in background using uvicorn
echo "Starting Python API on port 8001..."
uvicorn main:app --host 0.0.0.0 --port 8001 --reload > ../../logs/python.log 2>&1 &
PYTHON_PID=$!
echo $PYTHON_PID > ../../logs/python.pid
cd ../..

echo -e "${GREEN}✓ Python API started (PID: $PYTHON_PID)${NC}"
echo "  Logs: logs/python.log"
echo ""

# Step 3: Start Go Backend
echo -e "${YELLOW}[3/4] Starting Go Backend...${NC}"
cd backend/go

# Install Go dependencies
echo "Installing Go dependencies..."
go mod download
go get gorm.io/driver/postgres
go mod tidy

# Start Go backend in background
echo "Starting Go API on port 8080..."
go run main.go > ../../logs/go.log 2>&1 &
GO_PID=$!
echo $GO_PID > ../../logs/go.pid
cd ../..

echo -e "${GREEN}✓ Go Backend started (PID: $GO_PID)${NC}"
echo "  Logs: logs/go.log"
echo ""

# Step 4: Start Frontend
echo -e "${YELLOW}[4/4] Starting Frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

echo "Starting Frontend on port 5173..."
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..

echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo "  Logs: logs/frontend.log"
echo ""

echo "======================================"
echo -e "${GREEN}All services started successfully!${NC}"
echo "======================================"
echo ""
echo "Service URLs:"
echo "  Frontend:    http://localhost:5173"
echo "  Go API:      http://localhost:8080"
echo "  Python API:  http://localhost:8001"
echo "  PostgreSQL:  localhost:5432"
echo ""
echo "Process IDs (for stopping):"
echo "  Python: $PYTHON_PID (saved to logs/python.pid)"
echo "  Go:     $GO_PID (saved to logs/go.pid)"
echo "  Frontend: $FRONTEND_PID (saved to logs/frontend.pid)"
echo ""
echo "To stop all services, run: ./stop.sh"
echo "To view logs: tail -f logs/*.log"
echo ""
echo "Next steps:"
echo "  1. Index sample data: cd backend/python && python index_sample_data.py"
echo "  2. Open http://localhost:5173 and start searching!"
