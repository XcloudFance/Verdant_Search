FROM ubuntu:22.04

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_VERSION=20.x \
    GO_VERSION=1.21.0 \
    POSTGRES_VERSION=16

# 安装基础工具和添加 PostgreSQL 仓库
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

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    # 基础工具
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

# 安装 pgvector 扩展（从源码编译）
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

# 设置 Go 环境变量
ENV PATH="/usr/local/go/bin:$PATH" \
    GOPATH="/go" \
    GOBIN="/go/bin"

# 创建工作目录
WORKDIR /app

# 首先复制依赖文件（利用 Docker 层缓存）
COPY backend/python/requirements.txt /app/backend/python/
COPY backend/go/go.mod backend/go/go.sum /app/backend/go/
COPY frontend/package*.json /app/frontend/

# 安装 Python 依赖
WORKDIR /app/backend/python
RUN python3.11 -m venv venv && \
    . venv/bin/activate && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 下载 Go 依赖
WORKDIR /app/backend/go
RUN go mod download

# 安装前端依赖
WORKDIR /app/frontend
RUN npm ci --legacy-peer-deps

# 现在复制所有项目文件
COPY backend /app/backend
COPY frontend /app/frontend
COPY init.sql /app/init.sql

# 构建 Go 后端
WORKDIR /app/backend/go
RUN go build -o /app/go-backend main.go

# 构建前端
WORKDIR /app/frontend
RUN npm run build

# 安装 serve 来服务前端静态文件
RUN npm install -g serve

# 设置 PostgreSQL 数据目录
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql && \
    chown -R postgres:postgres /var/run/postgresql

# 创建 Redis 数据目录
RUN mkdir -p /var/lib/redis && chmod 755 /var/lib/redis

# 创建日志目录
RUN mkdir -p /var/log/supervisor /app/logs

# 创建启动脚本（初始化数据库）
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

# 初始化数据库
RUN su - postgres -c "/usr/lib/postgresql/${POSTGRES_VERSION}/bin/initdb -D /var/lib/postgresql/data" && \
    echo "host all all 0.0.0.0/0 md5" >> /var/lib/postgresql/data/pg_hba.conf && \
    echo "listen_addresses='*'" >> /var/lib/postgresql/data/postgresql.conf && \
    /usr/local/bin/init-db.sh

# 创建 Supervisor 配置
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

# 暴露端口
# 5173 - 前端（主要访问端口）
# 8080 - Go 后端
# 8001 - Python 后端
# 5432 - PostgreSQL
# 6379 - Redis
EXPOSE 5173 8080 8001 5432 6379

# 设置工作目录
WORKDIR /app

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:5173/ || exit 1

# 启动 Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
