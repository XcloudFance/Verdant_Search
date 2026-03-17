# Verdant Search Backend

Backend services for Verdant Search, including Go Gin API and Python FastAPI submodule.
his
## Architecture

- **Go (Gin)**: Main API server handling authentication, search, and history
- **Python (FastAPI)**: Search engine with indexing, vector search, BM25, and web crawler
  - 索引服务 (Index Service): 文档分词和索引
  - 搜索服务 (Search Service): BM25 + 向量混合搜索
  - 网页爬虫 (Web Crawler): 多进程分布式爬虫
- **PostgreSQL**: Database with pgvector extension for vector search
- **Redis**: Cache and crawler task queue


## Prerequisites

- Go 1.21+
- Python 3.9+
- Node.js 18+ (for frontend)

## Quick Start

### 1. Start Go API Server

```bash
cd backend/go
go run main.go
```

Server starts on `http://localhost:8080`

### 2. Start Python API (Optional)

```bash
cd backend/python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Server starts on `http://localhost:8001`

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend starts on `http://localhost:5173`

### 4. Start Web Crawler (Optional)

```bash
cd backend/crawler
python main.py --seeds https://www.python.org/
```

详细说明见: [crawler/QUICKSTART.md](crawler/QUICKSTART.md)


## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- `POST /api/auth/login` - Login
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

### Search

- `GET /api/search?q=<query>` - Search (returns mock data)

### History (Protected - requires JWT token)

- `GET /api/history` - Get search history
- `POST /api/history` - Add to history
  ```json
  {
    "query": "search term"
  }
  ```
- `DELETE /api/history/:id` - Delete specific history item
- `DELETE /api/history` - Clear all history

### Health Check

- `GET /health` - Server health check

## Environment Variables

Create a `.env` file in `backend/go/`:

```env
PORT=8080
JWT_SECRET=your-super-secret-key-change-this
DB_PATH=./verdant.db
```

## Database

SQLite database is created automatically on first run at `backend/go/verdant.db`.

### Schema

**users**
- id, email, name, password_hash, avatar, created_at, updated_at

**search_histories**
- id, user_id, query, timestamp, created_at

## Development

### Build Go Binary

```bash
cd backend/go
go build -o verdant-api
./verdant-api
```

### Run with Air (Hot Reload)

```bash
go install github.com/air-verse/air@latest
cd backend/go
air
```

## Web Crawler

多进程分布式网页爬虫，自动爬取网页内容并索引到搜索引擎。

### 功能特性

- ✅ 多进程并行爬取（可配置并发数）
- ✅ BFS策略爬取
- ✅ Redis Bloomfilter去重
- ✅ 自动提取标题和内容
- ✅ 集成分词和向量索引
- ✅ 支持种子URL配置

### 快速开始

```bash
# 启动Redis
redis-server &

# 启动爬虫（10个并发进程）
cd backend/crawler
python main.py --seeds https://www.python.org/
```

### 常用命令

```bash
# 自定义并发数
python main.py --workers 20 --seeds https://www.python.org/

# 查看统计信息
python main.py --stats

# 清空爬虫数据
python main.py --clear

# 测试单个页面
python example_single_page.py https://www.python.org/
```

### 配置

编辑 `crawler/config.py` 或设置环境变量：

```bash
export CRAWLER_WORKERS=20        # 并发进程数
export CRAWLER_MAX_DEPTH=3       # 最大爬取深度
export REDIS_CRAWLER_DB=1        # Redis数据库编号
```

### 文档

- 📖 [详细文档](crawler/README.md)
- 📝 [项目概览](crawler/OVERVIEW.md)
- 🚀 [快速入门](crawler/QUICKSTART.md)



## Production

1. Set proper `JWT_SECRET` in environment
2. Use PostgreSQL instead of SQLite
3. Enable Gin release mode: `gin.SetMode(gin.ReleaseMode)`
4. Use reverse proxy (nginx/caddy) for SSL

## License

MIT
