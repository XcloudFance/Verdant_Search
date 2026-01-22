# Verdant Search - Docker 单容器部署文档

## 快速开始

### 一键部署（推荐）

```bash
chmod +x docker-deploy.sh
./docker-deploy.sh
```

### 手动部署

#### 1. 构建镜像

```bash
docker build -t verdant-search:latest .
```

**注意**: 首次构建需要 10-20 分钟，因为需要下载 CLIP 模型（~500MB）和其他依赖。

#### 2. 运行容器

```bash
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
```

#### 3. 访问服务

- **搜索引擎前端**: http://localhost:5173
- **Go 后端 API**: http://localhost:8080
- **Python 搜索 API**: http://localhost:8001

## 架构说明

这个 Docker 镜像包含以下组件（全部运行在单个容器中）:

1. **PostgreSQL 16** (带 pgvector 扩展) - 端口 5432
2. **Redis Stack** - 端口 6379
3. **Python FastAPI 服务** - 端口 8001
   - 搜索引擎核心
   - 多模态搜索（文本 + 图片）
   - CLIP 嵌入模型
4. **Go Gin 后端** - 端口 8080
   - 用户认证
   - 搜索历史
5. **React 前端** - 端口 5173
   - 现代化搜索界面
   - 响应式设计

所有进程通过 **Supervisor** 管理，确保服务自动重启和稳定运行。

## 容器管理

### 查看日志

```bash
# 查看所有日志
docker logs -f verdant-search

# 进入容器查看特定服务日志
docker exec -it verdant-search tail -f /app/logs/python.log
docker exec -it verdant-search tail -f /app/logs/go.log
docker exec -it verdant-search tail -f /app/logs/frontend.log
docker exec -it verdant-search tail -f /app/logs/postgres.log
docker exec -it verdant-search tail -f /app/logs/redis.log
```

### 停止和启动

```bash
# 停止容器
docker stop verdant-search

# 启动容器
docker start verdant-search

# 重启容器
docker restart verdant-search
```

### 删除容器和数据

```bash
# 删除容器
docker rm -f verdant-search

# 删除容器和数据卷（谨慎操作！）
docker rm -f verdant-search
docker volume rm verdant-postgres-data verdant-redis-data
```

### 进入容器调试

```bash
# 进入容器 shell
docker exec -it verdant-search bash

# 查看所有运行的进程
docker exec -it verdant-search supervisorctl status

# 重启特定服务
docker exec -it verdant-search supervisorctl restart python-api
docker exec -it verdant-search supervisorctl restart go-backend
docker exec -it verdant-search supervisorctl restart frontend
```

## 数据持久化

数据通过 Docker volumes 持久化存储:

- `verdant-postgres-data`: PostgreSQL 数据库文件
- `verdant-redis-data`: Redis 数据文件

即使删除容器，数据仍然保留。如需完全清理数据，需要手动删除 volumes。

## 环境变量

如需自定义配置，可在运行容器时传入环境变量:

```bash
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -e DB_PASSWORD=your_password \
  -e JWT_SECRET=your_secret_key \
  verdant-search:latest
```

可用环境变量:
- `DB_HOST`: 数据库主机（默认: localhost）
- `DB_PORT`: 数据库端口（默认: 5432）
- `DB_USER`: 数据库用户（默认: verdant）
- `DB_PASSWORD`: 数据库密码（默认: verdant123）
- `DB_NAME`: 数据库名称（默认: verdant_search）
- `REDIS_URL`: Redis 连接地址（默认: redis://localhost:6379）
- `JWT_SECRET`: JWT 密钥（默认: your-secret-key-change-in-production）

## 健康检查

容器内置健康检查，每 30 秒检查一次前端服务是否正常:

```bash
# 查看容器健康状态
docker ps
```

健康状态会显示在 STATUS 列。

## 生产环境注意事项

⚠️ **警告**: 在单个容器中运行所有服务**不是生产环境的最佳实践**。这个 Dockerfile 主要用于:
- 开发和测试
- 快速演示
- 简化部署流程

生产环境建议:
1. 使用 Kubernetes 或 docker-compose 分离服务
2. 使用外部管理的数据库和 Redis
3. 配置适当的资源限制
4. 实施备份策略
5. 使用 HTTPS 和安全证书
6. 修改默认密码和密钥

## 性能优化

### 资源限制

```bash
docker run -d \
  --name verdant-search \
  --memory=4g \
  --cpus=2 \
  -p 5173:5173 \
  verdant-search:latest
```

### 构建缓存

为加快后续构建，可以使用构建缓存:

```bash
docker build \
  --cache-from verdant-search:latest \
  -t verdant-search:latest \
  .
```

## 故障排查

### 1. 容器启动失败

```bash
# 查看完整日志
docker logs verdant-search

# 检查特定服务状态
docker exec -it verdant-search supervisorctl status
```

### 2. 端口已被占用

修改端口映射:
```bash
docker run -d \
  --name verdant-search \
  -p 3000:5173 \
  -p 8090:8080 \
  verdant-search:latest
```

### 3. 数据库连接失败

进入容器检查 PostgreSQL:
```bash
docker exec -it verdant-search bash
su - postgres
psql -d verdant_search
```

### 4. 服务未启动

重启特定服务:
```bash
docker exec -it verdant-search supervisorctl restart all
```

## 索引数据

容器启动后，需要索引一些数据才能进行搜索:

```bash
# 进入容器
docker exec -it verdant-search bash

# 进入 Python 后端目录
cd /app/backend/python

# 激活虚拟环境并运行索引脚本
source venv/bin/activate
python index_sample_data.py
```

## 支持

如遇问题，请查看:
1. 容器日志: `docker logs verdant-search`
2. 服务日志: `/app/logs/` 目录下的各个日志文件
3. Supervisor 状态: `docker exec -it verdant-search supervisorctl status`
