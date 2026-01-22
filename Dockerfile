# github link: https://github.com/XcloudFance/Verdant_Search
FROM ubuntu:22.04


ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_VERSION=20.x \
    GO_VERSION=1.21.0 \
    POSTGRES_VERSION=16


RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    lsb-release \
    ca-certificates \
    software-properties-common \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    # Basic tools
    supervisor \
    # PostgreSQL
    postgresql-${POSTGRES_VERSION} \
    postgresql-contrib-${POSTGRES_VERSION} \
    # Redis
    redis-server \
    # Python 3
    python3.11 \
    python3.11-venv \
    python3-pip \
    # 构建工具
    build-essential \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector extension (compile from source)
RUN apt-get update && apt-get install -y \
    postgresql-server-dev-${POSTGRES_VERSION} \
    && cd /tmp \
    && git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector \
    && apt-get remove -y postgresql-server-dev-${POSTGRES_VERSION} git \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安装 Go
RUN wget https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz \
    && rm go${GO_VERSION}.linux-amd64.tar.gz

# Set Go environment variables
ENV PATH="/usr/local/go/bin:$PATH" \
    GOPATH="/go" \
    GOBIN="/go/bin"

# Create working directory
WORKDIR /app

# First copy dependency files (leverage Docker layer caching)
COPY backend/python/requirements.txt /app/backend/python/
COPY backend/go/go.mod backend/go/go.sum /app/backend/go/
COPY frontend/package*.json /app/frontend/

# Install Python dependencies
WORKDIR /app/backend/python
RUN python3.11 -m venv venv && \
    . venv/bin/activate && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download Go dependencies
WORKDIR /app/backend/go
RUN go mod download

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci --legacy-peer-deps

# Now copy all project files
COPY backend /app/backend
COPY frontend /app/frontend
COPY init.sql /app/init.sql

# Build Go backend
WORKDIR /app/backend/go
RUN go build -o /app/go-backend main.go

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Install serve to serve frontend static files
RUN npm install -g serve

# Set PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql && \
    chown -R postgres:postgres /var/run/postgresql

# Create Redis data directory
RUN mkdir -p /var/lib/redis && chmod 755 /var/lib/redis

# Create log directory
RUN mkdir -p /var/log/supervisor /app/logs

# Create startup script (initialize database)
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting PostgreSQL for initialization..."\n\
su - postgres -c "/usr/lib/postgresql/'${POSTGRES_VERSION}'/bin/pg_ctl -D /var/lib/postgresql/data -l /tmp/postgres.log start"\n\
sleep 5\n\
echo "Creating database and user..."\n\
su - postgres -c "psql -c \\"CREATE USER verdant WITH PASSWORD '\''verdant123'\'' SUPERUSER;\\"" || true\n\
su - postgres -c "psql -c \\"CREATE DATABASE verdant_search OWNER verdant;\\"" || true\n\
echo "Creating vector extension..."\n\
su - postgres -c "psql -d verdant_search -c '\''CREATE EXTENSION IF NOT EXISTS vector;'\''" || true\n\
echo "Running init.sql..."\n\
su - postgres -c "psql -d verdant_search -f /app/init.sql" || true\n\
echo "Stopping PostgreSQL..."\n\
su - postgres -c "/usr/lib/postgresql/'${POSTGRES_VERSION}'/bin/pg_ctl -D /var/lib/postgresql/data stop"\n\
echo "Database initialization complete!"\n\
' > /usr/local/bin/init-db.sh && chmod +x /usr/local/bin/init-db.sh

# Initialize database
RUN su - postgres -c "/usr/lib/postgresql/${POSTGRES_VERSION}/bin/initdb -D /var/lib/postgresql/data" && \
    echo "host all all 0.0.0.0/0 md5" >> /var/lib/postgresql/data/pg_hba.conf && \
    echo "listen_addresses='*'" >> /var/lib/postgresql/data/postgresql.conf && \
    /usr/local/bin/init-db.sh

# Create Supervisor configuration
COPY <<EOF /etc/supervisor/conf.d/verdant.conf
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
loglevel=info

[program:postgresql]
command=/usr/lib/postgresql/${POSTGRES_VERSION}/bin/postgres -D /var/lib/postgresql/data
user=postgres
autostart=true
autorestart=true
stdout_logfile=/app/logs/postgres.log
stderr_logfile=/app/logs/postgres_err.log
priority=1
startsecs=10

[program:redis]
command=/usr/bin/redis-server --appendonly yes --dir /var/lib/redis
autostart=true
autorestart=true
stdout_logfile=/app/logs/redis.log
stderr_logfile=/app/logs/redis_err.log
priority=2
startsecs=5

[program:python-api]
command=/app/backend/python/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
directory=/app/backend/python
autostart=true
autorestart=true
stdout_logfile=/app/logs/python.log
stderr_logfile=/app/logs/python_err.log
priority=3
startsecs=10
environment=DB_HOST="localhost",DB_PORT="5432",DB_USER="verdant",DB_PASSWORD="verdant123",DB_NAME="verdant_search",REDIS_URL="redis://localhost:6379"

[program:go-backend]
command=/app/go-backend
directory=/app/backend/go
autostart=true
autorestart=true
stdout_logfile=/app/logs/go.log
stderr_logfile=/app/logs/go_err.log
priority=4
startsecs=10
environment=DB_HOST="localhost",DB_PORT="5432",DB_USER="verdant",DB_PASSWORD="verdant123",DB_NAME="verdant_search",PORT="8080",JWT_SECRET="your-secret-key-change-in-production"

[program:frontend]
command=/usr/bin/serve -s dist -l 5173 --no-clipboard
directory=/app/frontend
autostart=true
autorestart=true
stdout_logfile=/app/logs/frontend.log
stderr_logfile=/app/logs/frontend_err.log
priority=5
startsecs=5
EOF

# Expose ports
# 5173 - Frontend (main access port)
# 8080 - Go backend
# 8001 - Python backend
# 5432 - PostgreSQL
# 6379 - Redis
EXPOSE 5173 8080 8001 5432 6379

# Set working directory
WORKDIR /app

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:5173/ || exit 1

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
