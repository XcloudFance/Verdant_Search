# Verdant Search - 快速启动指南

## 🚀 一行命令启动

直接暴露搜索引擎端口并访问:

```bash
docker run -d --name verdant-search -p 5173:5173 verdant-search:latest && echo "搜索引擎已启动！访问 http://localhost:5173"
```

**前提条件**: 需要先构建镜像

## 📦 完整部署（推荐）

### 方法一：使用自动化脚本

```bash
./docker-deploy.sh
```

### 方法二：手动两步部署

```bash
# 步骤 1: 构建镜像
docker build -t verdant-search:latest .

# 步骤 2: 运行容器（仅暴露搜索引擎端口）
docker run -d --name verdant-search -p 5173:5173 verdant-search:latest
```

然后访问: **http://localhost:5173**

## 🔧 暴露所有端口（开发模式）

如果需要访问所有服务:

```bash
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -p 8080:8080 \
  -p 8001:8001 \
  -p 5432:5432 \
  -p 6379:6379 \
  verdant-search:latest
```

访问地址:
- 🌐 **搜索引擎**: http://localhost:5173
- 🔧 Go API: http://localhost:8080
- 🐍 Python API: http://localhost:8001
- 🗄️ PostgreSQL: localhost:5432
- 📦 Redis: localhost:6379

## 📝 快速命令参考

| 操作 | 命令 |
|------|------|
| 构建镜像 | `docker build -t verdant-search:latest .` |
| 运行容器（仅搜索引擎） | `docker run -d --name verdant-search -p 5173:5173 verdant-search:latest` |
| 查看日志 | `docker logs -f verdant-search` |
| 停止容器 | `docker stop verdant-search` |
| 启动容器 | `docker start verdant-search` |
| 删除容器 | `docker rm -f verdant-search` |
| 进入容器 | `docker exec -it verdant-search bash` |

## ⏱️ 启动时间

- 首次构建: **10-20 分钟** (需下载依赖和 CLIP 模型)
- 首次启动: **30-60 秒** (等待所有服务启动)
- 后续启动: **10-20 秒**

## 💾 数据持久化（可选）

如需保留数据，添加 volumes:

```bash
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -v verdant-postgres-data:/var/lib/postgresql/data \
  -v verdant-redis-data:/var/lib/redis \
  verdant-search:latest
```

## 🎯 最简单的启动方式（三步）

```bash
# 1. 构建
docker build -t verdant-search:latest .

# 2. 运行
docker run -d --name verdant-search -p 5173:5173 verdant-search:latest

# 3. 访问
echo "打开浏览器访问: http://localhost:5173"
```

就这么简单！🎉

---

**详细文档**: 查看 `DOCKER_DEPLOYMENT.md` 了解更多详情
