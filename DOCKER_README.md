# 🚀 Verdant Search - Docker 单容器部署

## ⚡ 一行命令启动（快速上手）

```bash
docker build -t verdant-search . && docker run -d --name verdant-search -p 5173:5173 verdant-search && echo "✅ 搜索引擎已启动！访问 http://localhost:5173"
```

**这一条命令就完成了**：
1. 构建 Docker 镜像（包含所有依赖）
2. 启动容器（PostgreSQL + Redis + Python API + Go Backend + Frontend）
3. 暴露搜索引擎端口 5173

**首次构建**: 10-20 分钟（下载 CLIP 模型和依赖）  
**首次启动**: 等待 60-90 秒让所有服务启动

---

## 📦 这个容器包含什么？

**单个 Docker 容器运行所有服务**（除了爬虫）：

| 服务 | 端口 | 说明 |
|------|------|------|
| React 前端 | 5173 | 搜索引擎界面（主要访问端口）|
| Python FastAPI | 8001 | 搜索引擎核心 + 多模态搜索 |
| Go Gin Backend | 8080 | 用户认证 + 搜索历史 |
| PostgreSQL 16 | 5432 | 数据库（含 pgvector 扩展）|
| Redis | 6379 | 缓存服务 |

所有服务通过 **Supervisor** 管理，自动重启，高可用。

---

## 🎯 使用方法

### 方法 1：一键部署脚本（推荐）

```bash
chmod +x docker-deploy.sh
./docker-deploy.sh
```

### 方法 2：手动分步部署

```bash
# 1. 构建镜像
docker build -t verdant-search:latest .

# 2. 运行容器（仅暴露搜索引擎端口）
docker run -d --name verdant-search -p 5173:5173 verdant-search:latest

# 3. 访问
open http://localhost:5173  # macOS
# 或直接在浏览器打开 http://localhost:5173
```

### 方法 3：开发模式（暴露所有端口）

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

---

## 📊 访问地址

启动成功后，可以访问：

- 🌐 **搜索引擎**: http://localhost:5173
- 🔧 Go API: http://localhost:8080 （需暴露端口）
- 🐍 Python API: http://localhost:8001 （需暴露端口）

---

## 🛠️ 常用命令

```bash
# 查看日志
docker logs -f verdant-search

# 查看特定服务日志
docker exec -it verdant-search tail -f /app/logs/python.log
docker exec -it verdant-search tail -f /app/logs/go.log
docker exec -it verdant-search tail -f /app/logs/frontend.log
docker exec -it verdant-search tail -f /app/logs/postgres.log
docker exec -it verdant-search tail -f /app/logs/redis.log

# 停止容器
docker stop verdant-search

# 启动容器
docker start verdant-search

# 重启容器
docker restart verdant-search

# 删除容器
docker rm -f verdant-search

# 进入容器
docker exec -it verdant-search bash

# 查看所有服务状态
docker exec -it verdant-search supervisorctl status

# 重启特定服务
docker exec -it verdant-search supervisorctl restart python-api
docker exec -it verdant-search supervisorctl restart go-backend
docker exec -it verdant-search supervisorctl restart frontend
```

---

## 💾 数据持久化

如需保留数据（推荐生产环境）：

```bash
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -v verdant-postgres-data:/var/lib/postgresql/data \
  -v verdant-redis-data:/var/lib/redis \
  verdant-search:latest
```

数据卷说明：
- `verdant-postgres-data`: PostgreSQL 数据库文件
- `verdant-redis-data`: Redis 数据文件

即使删除容器，数据仍然保留。

---

## 🔍 故障排查

### 1. 容器无法启动

```bash
# 查看详细日志
docker logs verdant-search

# 检查端口是否被占用
lsof -i :5173  # macOS/Linux
netstat -ano | findstr :5173  # Windows
```

### 2. 服务未正常运行

```bash
# 进入容器查看服务状态
docker exec -it verdant-search supervisorctl status

# 重启所有服务
docker exec -it verdant-search supervisorctl restart all
```

### 3. 端口已被占用

修改端口映射：
```bash
docker run -d \
  --name verdant-search \
  -p 3000:5173 \  # 使用端口 3000 代替 5173
  verdant-search:latest
```

然后访问 http://localhost:3000

### 4. 数据库连接失败

```bash
# 进入容器
docker exec -it verdant-search bash

# 检查 PostgreSQL
su - postgres -c "psql -d verdant_search -c 'SELECT COUNT(*) FROM documents;'"
```

---

## 📚 文档

- **快速启动**: `QUICK_START.md`
- **完整部署文档**: `DOCKER_DEPLOYMENT.md`
- **项目 README**: `README.md`

---

## ⚠️ 注意事项

### 生产环境警告

在单个容器中运行所有服务**不是生产环境的最佳实践**。这个 Dockerfile 主要用于：
- ✅ 开发和测试
- ✅ 快速演示
- ✅ 简化部署流程

**生产环境建议**：
1. 使用 Kubernetes 或 docker-compose 分离服务
2. 使用外部管理的数据库和 Redis
3. 配置适当的资源限制
4. 实施备份策略
5. 使用 HTTPS 和安全证书
6. 修改默认密码和密钥

### 安全建议

默认配置使用的密码和密钥仅供开发使用，生产环境请修改：

```bash
docker run -d \
  --name verdant-search \
  -p 5173:5173 \
  -e DB_PASSWORD=your_secure_password \
  -e JWT_SECRET=your_secure_secret_key \
  verdant-search:latest
```

---

## 🎓 索引数据

容器启动后，需要索引一些数据才能进行搜索：

```bash
# 进入容器
docker exec -it verdant-search bash

# 进入 Python 后端目录
cd /app/backend/python

# 激活虚拟环境并运行索引脚本
source venv/bin/activate
python index_sample_data.py
```

---

## 🌟 特性

- ✨ **单容器部署** - 一个 Dockerfile 搞定所有服务
- 🚀 **快速启动** - 一行命令即可运行
- 🔍 **多模态搜索** - 支持文本和图片搜索
- 💡 **智能排序** - BM25 + 向量检索混合排序
- 🎨 **现代化界面** - React + Material-UI
- 🔐 **用户认证** - JWT Token 认证
- 📊 **搜索历史** - 记录用户搜索历史
- 🐳 **容器化** - 完全容器化，易于部署

---

## 📝 项目架构

```
Single Docker Container
├── PostgreSQL 16 (数据库 + pgvector)
├── Redis (缓存)
├── Python FastAPI (搜索引擎核心)
│   ├── CLIP 多模态模型
│   ├── BM25 排序
│   └── 向量检索
├── Go Gin (后端 API)
│   ├── 用户认证
│   └── 搜索历史
└── React Frontend (用户界面)
    ├── 搜索页面
    ├── 结果展示
    └── 用户管理
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可

MIT License

---

## 🎉 快速上手总结

**最简单的方式**：

```bash
# 构建并运行（一行命令）
docker build -t verdant-search . && docker run -d --name verdant-search -p 5173:5173 verdant-search && echo "访问 http://localhost:5173"
```

**或者使用脚本**：

```bash
./docker-deploy.sh
```

就这么简单！🎊
