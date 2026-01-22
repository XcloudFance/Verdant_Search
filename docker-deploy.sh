#!/bin/bash

# Verdant Search - Docker Single Container Deployment Script

set -e

echo "======================================"
echo "Verdant Search - Docker Deployment"
echo "======================================"
echo ""

# Build Docker image
echo "[1/2] Building Docker image..."
echo "Note: First build may take 10-20 minutes, please be patient..."
docker build -t verdant-search:latest . --progress=plain

echo ""
echo "✓ Image build completed"
echo ""

# Run container
echo "[2/2] Starting container..."
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -p 8080:8080 \
  -p 8001:8001 \
  -p 5432:5432 \
  -p 6379:6379 \
  -v verdant-postgres-data:/var/lib/postgresql/data \
  -v verdant-redis-data:/var/lib/redis \
  verdant-search:latest

echo ""
echo "======================================"
echo "✓ Deployment completed!"
echo "======================================"
echo ""
echo "Service URLs:"
echo "  🌐 Search Frontend:  http://localhost:5173"
echo "  🔧 Go API:           http://localhost:8080"
echo "  🐍 Python API:       http://localhost:8001"
echo "  🗄️  PostgreSQL:       localhost:5432"
echo "  📦 Redis:            localhost:6379"
echo ""
echo "Common commands:"
echo "  View logs:       docker logs -f verdant-search"
echo "  Stop container:  docker stop verdant-search"
echo "  Start container: docker start verdant-search"
echo "  Remove container: docker rm -f verdant-search"
echo "  Enter container: docker exec -it verdant-search bash"
echo ""
echo "Data persistence:"
echo "  PostgreSQL volume: verdant-postgres-data"
echo "  Redis volume:      verdant-redis-data"
echo ""
echo "Note: First startup requires 30-60 seconds for all services to fully initialize"
echo "      You can monitor startup progress with 'docker logs -f verdant-search'"
echo ""
