#!/bin/bash
# ==============================================================
#  Verdant Search — One-Click Start Script
#  Starts all services: PostgreSQL, Redis, Python API, Go API, Frontend
#  Runs database migrations automatically on every startup.
# ==============================================================

set -e

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓ $*${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "  ${RED}✗ $*${NC}"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}[$1]${NC} $2"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p logs

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}       Verdant Search — Starting Up        ${NC}"
echo -e "${BOLD}============================================${NC}"

# ── Step 0: Check prerequisites ───────────────────────────────
step "0/5" "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || err "Docker not found. Install Docker first."
docker info >/dev/null 2>&1     || err "Docker is not running. Please start Docker."
command -v python3 >/dev/null 2>&1 || err "python3 not found."
command -v go >/dev/null 2>&1      || err "go not found. Install Go 1.21+."
command -v node >/dev/null 2>&1    || err "node not found. Install Node.js 18+."
command -v npm >/dev/null 2>&1     || err "npm not found."

ok "All prerequisites satisfied"

# ── Step 1: Start PostgreSQL + Redis via Docker Compose ───────
step "1/5" "Starting PostgreSQL + Redis..."

docker-compose up -d

# Wait for PostgreSQL to be healthy
echo -n "  Waiting for PostgreSQL"
for i in $(seq 1 30); do
    if docker exec verdant_postgres pg_isready -U verdant -q 2>/dev/null; then
        echo ""
        ok "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo ""
        err "PostgreSQL did not become ready in 30 seconds. Check: docker-compose logs postgres"
    fi
done

# Wait for Redis to be healthy
echo -n "  Waiting for Redis"
for i in $(seq 1 15); do
    if docker exec verdant_redis redis-cli ping >/dev/null 2>&1; then
        echo ""
        ok "Redis is ready"
        break
    fi
    echo -n "."
    sleep 1
    if [ "$i" -eq 15 ]; then
        echo ""
        warn "Redis may not be ready yet, continuing anyway..."
    fi
done

# ── Step 2: Set up Python environment + install deps ──────────
step "2/5" "Setting up Python environment..."

cd backend/python

if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install/update dependencies quietly
echo "  Installing Python dependencies (this may take a while on first run)..."
pip install -q -r requirements.txt
ok "Python dependencies installed"

# ── Step 3: Run database migrations ───────────────────────────
step "3/5" "Running database migrations..."

python migrate.py
cd "$SCRIPT_DIR"

# ── Step 4: Start backend services ────────────────────────────
step "4/5" "Starting backend services..."

# -- Python API --
echo "  Starting Python Search API on :8001..."
cd backend/python
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 \
    > "$SCRIPT_DIR/logs/python.log" 2>&1 &
PYTHON_PID=$!
echo $PYTHON_PID > "$SCRIPT_DIR/logs/python.pid"
cd "$SCRIPT_DIR"
ok "Python API started (PID $PYTHON_PID)  → logs/python.log"

# -- Go API --
echo "  Starting Go Backend API on :8080..."
cd backend/go
go run main.go > "$SCRIPT_DIR/logs/go.log" 2>&1 &
GO_PID=$!
echo $GO_PID > "$SCRIPT_DIR/logs/go.pid"
cd "$SCRIPT_DIR"
ok "Go API started (PID $GO_PID)  → logs/go.log"

# ── Step 5: Start frontend ─────────────────────────────────────
step "5/5" "Starting Frontend..."

cd frontend

if [ ! -d "node_modules" ]; then
    echo "  Installing Node dependencies..."
    npm install
fi

npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/logs/frontend.pid"
cd "$SCRIPT_DIR"
ok "Frontend started (PID $FRONTEND_PID)  → logs/frontend.log"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  All services started successfully! 🚀${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo -e "  ${BOLD}Service URLs:${NC}"
echo -e "  ${GREEN}●${NC} Frontend       http://localhost:5173"
echo -e "  ${GREEN}●${NC} Admin Panel    http://localhost:5173/admin"
echo -e "  ${GREEN}●${NC} Go API         http://localhost:8080"
echo -e "  ${GREEN}●${NC} Python API     http://localhost:8001"
echo -e "  ${GREEN}●${NC} API Docs       http://localhost:8001/docs"
echo -e "  ${GREEN}●${NC} RedisInsight   http://localhost:8002"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  tail -f logs/python.log    # Python API logs"
echo -e "  tail -f logs/go.log        # Go API logs"
echo -e "  tail -f logs/frontend.log  # Frontend logs"
echo -e "  ./stop.sh                  # Stop all services"
echo ""
echo -e "  ${YELLOW}Tip: First run downloads the CLIP model (~500MB).${NC}"
echo -e "  ${YELLOW}     Index test data: cd backend/python && python index_sample_data.py${NC}"
echo ""
