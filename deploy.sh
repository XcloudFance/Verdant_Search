#!/bin/bash
# ================================================================
#  Verdant Search — One-Click Deployment Script
#  Prerequisites: Docker, Anaconda (conda), Go 1.21+, Node.js 18+
# ================================================================

set -e

# ── Terminal colours ─────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()    { echo -e "  ${GREEN}✓${NC}  $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "\n  ${RED}✗  ERROR: $*${NC}\n"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}── Step $1 ──────────────────────────────────────────${NC}\n  $2"; }
banner(){ echo -e "\n${BOLD}$*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p logs

CONDA_ENV_NAME="verdant"

# ================================================================
banner "╔══════════════════════════════════════════════════╗"
banner "║       Verdant Search — Deployment Script         ║"
banner "╚══════════════════════════════════════════════════╝"
# ================================================================

# ── Step 1: Check prerequisites ──────────────────────────────
step "1/6" "Checking prerequisites..."

command -v docker >/dev/null 2>&1  || err "Docker not found. Install from https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1        || err "Docker daemon is not running. Please start Docker."
command -v go >/dev/null 2>&1      || err "Go not found. Install from https://go.dev/dl/ (need v1.21+)"
command -v node >/dev/null 2>&1    || err "Node.js not found. Install from https://nodejs.org (need v18+)"
command -v npm >/dev/null 2>&1     || err "npm not found. It ships with Node.js."

# Locate conda (works for Anaconda / Miniconda / Miniforge)
CONDA_CMD=""
for candidate in conda "$HOME/anaconda3/bin/conda" "$HOME/miniconda3/bin/conda" \
                 "$HOME/miniforge3/bin/conda" "/opt/anaconda3/bin/conda" \
                 "/opt/miniconda3/bin/conda"; do
    if command -v "$candidate" >/dev/null 2>&1; then
        CONDA_CMD="$candidate"
        break
    fi
done
[ -n "$CONDA_CMD" ] || err "conda not found. Install Anaconda or Miniconda from https://docs.conda.io/en/latest/miniconda.html"

GO_VER=$(go version | awk '{print $3}' | sed 's/go//')
NODE_VER=$(node --version | sed 's/v//')
ok "Docker        $(docker --version | awk '{print $3}' | tr -d ',')"
ok "conda         $($CONDA_CMD --version)"
ok "Go            $GO_VER"
ok "Node.js       v$NODE_VER"

# ── Step 2: Environment configuration (.env) ─────────────────
step "2/6" "Configuring environment..."

if [ ! -f ".env" ]; then
    echo ""
    echo -e "  ${YELLOW}No .env file found. Let's set up your configuration.${NC}"
    echo -e "  ${YELLOW}(Press Enter to accept defaults shown in brackets)${NC}"
    echo ""

    cp .env.example .env

    # Prompt for the most important value: the LLM API key
    echo -n "  LLM Provider [anthropic / openai] (default: anthropic): "
    read -r LLM_PROVIDER_INPUT
    LLM_PROVIDER_INPUT="${LLM_PROVIDER_INPUT:-anthropic}"
    sed -i "s/^LLM_PROVIDER=.*/LLM_PROVIDER=${LLM_PROVIDER_INPUT}/" .env

    if [ "$LLM_PROVIDER_INPUT" = "anthropic" ]; then
        echo -n "  Anthropic API key (sk-ant-...): "
        read -r API_KEY_INPUT
        if [ -n "$API_KEY_INPUT" ]; then
            sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${API_KEY_INPUT}|" .env
            ok "Anthropic API key saved"
        else
            warn "No API key entered — AI features will not work. Edit .env later."
        fi
    else
        echo -n "  OpenAI API key (sk-...): "
        read -r API_KEY_INPUT
        if [ -n "$API_KEY_INPUT" ]; then
            sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${API_KEY_INPUT}|" .env
            ok "OpenAI API key saved"
        fi
    fi

    # JWT secret
    JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48 2>/dev/null || echo "verdant-jwt-secret-please-change-me")
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
    ok ".env created from template"
else
    ok ".env already exists — skipping setup"
fi

# Export vars for child processes
set -a; source .env; set +a

# ── Step 3: Start Docker services (PostgreSQL + Redis) ────────
step "3/6" "Starting Docker services (PostgreSQL + Redis)..."

docker compose up -d

# Wait for PostgreSQL
echo -n "  Waiting for PostgreSQL"
for i in $(seq 1 40); do
    if docker exec verdant_postgres pg_isready -U verdant -q 2>/dev/null; then
        echo ""; ok "PostgreSQL is ready"; break
    fi
    echo -n "."; sleep 1
    [ "$i" -eq 40 ] && { echo ""; err "PostgreSQL did not start in 40s. Check: docker compose logs postgres"; }
done

# Wait for Redis
echo -n "  Waiting for Redis"
for i in $(seq 1 20); do
    if docker exec verdant_redis redis-cli ping >/dev/null 2>&1; then
        echo ""; ok "Redis is ready"; break
    fi
    echo -n "."; sleep 1
    [ "$i" -eq 20 ] && { echo ""; warn "Redis may not be ready yet, continuing..."; }
done

# ── Step 4: Python (conda) environment + dependencies ─────────
step "4/6" "Setting up Python conda environment ('${CONDA_ENV_NAME}')..."

# Source conda for this shell session
CONDA_BASE=$($CONDA_CMD info --base)
# shellcheck disable=SC1091
source "${CONDA_BASE}/etc/profile.d/conda.sh"

if $CONDA_CMD env list | grep -q "^${CONDA_ENV_NAME} "; then
    ok "Conda env '${CONDA_ENV_NAME}' already exists — reusing it"
else
    echo "  Creating conda env '${CONDA_ENV_NAME}' with Python 3.11..."
    $CONDA_CMD create -y -n "$CONDA_ENV_NAME" python=3.11 >/dev/null
    ok "Conda env created"
fi

conda activate "$CONDA_ENV_NAME"

echo "  Installing Python dependencies..."
echo "  ${YELLOW}(First run downloads PyTorch + CLIP model, may take several minutes)${NC}"
pip install -q -r backend/python/requirements.txt
ok "Python dependencies installed"

# ── Step 4b: Run database migrations ─────────────────────────
echo ""
echo -e "  Running database migrations..."
(cd backend/python && python migrate.py)
ok "Database schema up to date"

# ── Step 5: Start backend services ───────────────────────────
step "5/6" "Starting backend services..."

# ── Python API (port 8001) ────────────────────────────────────
echo "  Starting Python Search API on :8001..."
(
    conda activate "$CONDA_ENV_NAME" 2>/dev/null
    cd backend/python
    uvicorn main:app --host 0.0.0.0 --port 8001 \
        > "$SCRIPT_DIR/logs/python.log" 2>&1
) &
PYTHON_PID=$!
echo $PYTHON_PID > logs/python.pid
ok "Python API started (PID $PYTHON_PID)  → logs/python.log"

# ── Go API (port 8080) ────────────────────────────────────────
echo "  Starting Go Backend API on :8080..."
(
    cd backend/go
    go run main.go > "$SCRIPT_DIR/logs/go.log" 2>&1
) &
GO_PID=$!
echo $GO_PID > logs/go.pid
ok "Go API started (PID $GO_PID)  → logs/go.log"

# Brief pause so APIs can bind before frontend starts
sleep 2

# ── Step 6: Frontend ─────────────────────────────────────────
step "6/6" "Starting Frontend (React) on :5173..."

if [ ! -d "frontend/node_modules" ]; then
    echo "  Installing Node dependencies (first time only)..."
    (cd frontend && npm install)
    ok "Node dependencies installed"
fi

(cd frontend && npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1) &
FRONTEND_PID=$!
echo $FRONTEND_PID > logs/frontend.pid
ok "Frontend started (PID $FRONTEND_PID)  → logs/frontend.log"

# ── Wait for Python API health ───────────────────────────────
echo ""
echo -e "  Waiting for services to be ready..."
sleep 3
for i in $(seq 1 20); do
    if curl -sf http://localhost:8001/health >/dev/null 2>&1; then
        ok "Python API is healthy"; break
    fi
    sleep 1
    [ "$i" -eq 20 ] && warn "Python API slow to start — check logs/python.log"
done

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║          Verdant Search is running! 🚀           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Service URLs:${NC}"
echo -e "  ${GREEN}●${NC}  Frontend        →  http://localhost:5173"
echo -e "  ${GREEN}●${NC}  Admin Panel     →  http://localhost:5173/admin"
echo -e "  ${GREEN}●${NC}  Python API      →  http://localhost:8001"
echo -e "  ${GREEN}●${NC}  API Docs        →  http://localhost:8001/docs"
echo -e "  ${GREEN}●${NC}  Go API          →  http://localhost:8080"
echo -e "  ${GREEN}●${NC}  RedisInsight    →  http://localhost:8002"
echo ""
echo -e "  ${BOLD}Log tailing:${NC}"
echo -e "  tail -f logs/python.log     # Search API + AI"
echo -e "  tail -f logs/go.log         # Auth + history API"
echo -e "  tail -f logs/frontend.log   # React dev server"
echo ""
echo -e "  ${BOLD}Stop everything:${NC}  ./stop.sh"
echo ""
echo -e "  ${YELLOW}Tip:${NC} First run downloads CLIP model (~500 MB) — Python API"
echo -e "       may take a minute before it starts serving requests."
echo -e "  ${YELLOW}Tip:${NC} Index content via:  cd backend/python && python index_service.py"
echo ""
