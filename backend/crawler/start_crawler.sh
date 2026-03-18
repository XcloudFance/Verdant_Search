#!/bin/bash
# Verdant Search — Crawler Start Script

cd "$(dirname "$0")"
REPO_ROOT="$(cd "../../" && pwd)"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "\n  ${RED}✗  $*${NC}\n"; exit 1; }

echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║    Verdant Search — Web Crawler      ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Load project .env so BACKEND_API_URL and REDIS_* are inherited ───────────
if [ -f "$REPO_ROOT/.env" ]; then
    set -a; source "$REPO_ROOT/.env"; set +a
    ok "Loaded $REPO_ROOT/.env"
else
    warn ".env not found at $REPO_ROOT — using defaults"
fi

# BACKEND_API_URL: default to localhost:8001 (crawler runs on same machine)
BACKEND_API_URL="${BACKEND_API_URL:-http://localhost:8001}"
export BACKEND_API_URL
ok "Backend API : $BACKEND_API_URL"

# ── Locate Python (prefer conda env 'verdant', fall back to system python3) ──
PYTHON_CMD=""
CONDA_BASE=""
for candidate in conda "$HOME/anaconda3/bin/conda" "$HOME/miniconda3/bin/conda" \
                 "$HOME/miniforge3/bin/conda" "/opt/anaconda3/bin/conda"; do
    if command -v "$candidate" >/dev/null 2>&1; then
        CONDA_BASE=$("$candidate" info --base 2>/dev/null)
        break
    fi
done

if [ -n "$CONDA_BASE" ] && [ -f "$CONDA_BASE/etc/profile.d/conda.sh" ]; then
    # shellcheck disable=SC1091
    source "$CONDA_BASE/etc/profile.d/conda.sh"
    if conda env list 2>/dev/null | grep -q "^verdant "; then
        conda activate verdant 2>/dev/null
        PYTHON_CMD="python"
        ok "Python      : conda env 'verdant'  ($(python --version 2>&1))"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    PYTHON_CMD="python3"
    ok "Python      : $(python3 --version 2>&1) (system)"
fi

# ── Check Docker services ─────────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Checking services...${NC}"
docker exec verdant_redis redis-cli ping >/dev/null 2>&1 \
    || err "Redis not running. Start with: docker compose up -d"
ok "Redis is up"

docker exec verdant_postgres pg_isready -U verdant >/dev/null 2>&1 \
    || err "PostgreSQL not running. Start with: docker compose up -d"
ok "PostgreSQL is up"

# ── Check backend API reachable ───────────────────────────────────────────────
if curl -sf "${BACKEND_API_URL}/health" >/dev/null 2>&1 \
|| curl -sf "${BACKEND_API_URL}/docs" >/dev/null 2>&1; then
    ok "Backend API is reachable at $BACKEND_API_URL"
else
    warn "Backend API not responding at $BACKEND_API_URL"
    warn "Workers will start in offline mode (no panel registration)"
fi
echo ""

# ── Check/install crawler dependencies ───────────────────────────────────────
if ! $PYTHON_CMD -c "from DrissionPage import SessionPage; import trafilatura, redis, pybloom_live" \
       >/dev/null 2>&1; then
    warn "Missing crawler dependencies — installing..."
    pip install -q -r requirements.txt
fi
ok "Crawler dependencies OK"
echo ""

# ── Seed URL logic ────────────────────────────────────────────────────────────
# FIX: Always capture seeds FIRST (from args or user input).
# Seeds are stored before any clearing, so clear never loses them.

WORKERS=${CRAWLER_WORKERS:-3}

# Get seeds from command-line args
if [ $# -gt 0 ]; then
    SEEDS="$*"
else
    # Check queue so we can show context, but DON'T skip the seed prompt
    QUEUE_SIZE=$(docker exec verdant_redis redis-cli -n 1 LLEN crawler:task_queue 2>/dev/null || echo "0")

    if [ "$QUEUE_SIZE" -gt 0 ]; then
        echo -e "  ${GREEN}Queue has ${QUEUE_SIZE} pending URLs.${NC}"
        echo -e "  Press Enter to continue from queue, or enter new seed URLs to add:"
    else
        echo -e "  ${YELLOW}Queue is empty. Enter seed URLs to crawl:${NC}"
    fi
    echo -e "  ${YELLOW}Example: https://example.com/ https://docs.example.com/${NC}"
    read -rp "  > " SEEDS

    # If queue was non-empty and user pressed Enter, continue from queue (no seeds needed)
    if [ -z "$SEEDS" ] && [ "${QUEUE_SIZE:-0}" -gt 0 ]; then
        echo ""
        ok "Resuming from queue ($QUEUE_SIZE items)"
    elif [ -z "$SEEDS" ]; then
        err "No seed URLs provided and queue is empty. Please enter at least one URL."
    fi
fi

# ── Clear old data? ───────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Options:${NC}"
echo -e "  [1] Fresh start  — clear visited history + queue, then seed with new URLs"
echo -e "  [2] Clear queue  — clear queue only (keep visited history), re-add seeds"
echo -e "  [3] Continue     — keep queue and history as-is, append seeds if any"
read -rp "  Choose [1/2/3] (default: 3): " CLEAR_CHOICE
CLEAR_CHOICE="${CLEAR_CHOICE:-3}"
echo ""

case "$CLEAR_CHOICE" in
    1)
        echo -e "  ${YELLOW}Clearing all crawler data (queue + bloom filter)...${NC}"
        $PYTHON_CMD main.py --clear
        ok "All data cleared"
        # Seeds captured above will be re-added when crawler starts
        ;;
    2)
        echo -e "  ${YELLOW}Clearing task queue only (keeping visited history)...${NC}"
        docker exec verdant_redis redis-cli -n 1 DEL crawler:task_queue >/dev/null
        ok "Queue cleared (bloom filter kept — already-visited URLs won't be re-crawled)"
        ;;
    3)
        ok "Continuing with existing state"
        ;;
    *)
        warn "Invalid choice, continuing with existing state"
        ;;
esac

# ── Show config summary ───────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Starting crawler:${NC}"
echo -e "  Workers     : $WORKERS"
echo -e "  Backend API : $BACKEND_API_URL"
if [ -n "$SEEDS" ]; then
    echo -e "  Seeds       : $SEEDS"
else
    echo -e "  Seeds       : (continuing from queue)"
fi
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# ── Launch ────────────────────────────────────────────────────────────────────
if [ -n "$SEEDS" ]; then
    exec $PYTHON_CMD main.py --workers "$WORKERS" --seeds $SEEDS
else
    exec $PYTHON_CMD main.py --workers "$WORKERS"
fi
