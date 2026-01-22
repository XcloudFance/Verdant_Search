# Verdant Search - 完整启动指南

一个完整的混合搜索引擎，包含用户认证、搜索历史和AI搜索功能。

## 🏗️ 系统架构

```
Frontend (React) 
    ↓
Go Gin Backend (8080)
    ↓
Python FastAPI (8001) 
    ↓
PostgreSQL + pgvector (5432)
```

## 📋 前置要求

- **Docker & Docker Compose** - 运行PostgreSQL
- **Go 1.21+** - Go后端
- **Python 3.9+** - Python搜索引擎
- **Node.js 18+** - 前端

## 🚀 快速启动（推荐）

### 方式一：使用启动脚本（最简单）

```bash
# 给脚本添加执行权限
chmod +x start.sh stop.sh

# 启动所有服务
./start.sh

# 停止所有服务
./stop.sh
```

### 方式二：手动启动（分步骤）

#### 第1步：启动PostgreSQL

```bash
# 启动PostgreSQL容器
docker-compose up -d

# 查看是否启动成功
docker ps
docker logs verdant_postgres
```

#### 第2步：启动Python搜索API

```bash
cd backend/python

# 创建虚拟环境（首次）
python -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖（首次或更新后）
pip install -r requirements.txt

# 启动Python API
python main.py
```

**运行在**: `http://localhost:8001`

⚠️ **首次运行会下载CLIP模型（~500MB），请耐心等待**

#### 第3步：启动Go后端

打开新终端：

```bash
cd backend/go

# 安装Go依赖（首次）
go mod download
go get gorm.io/driver/postgres

# 启动Go后端
go run main.go
```

**运行在**: `http://localhost:8080`

#### 第4步：启动前端

再打开一个新终端：

```bash
cd frontend

# 安装依赖（首次）
npm install

# 启动前端
npm run dev
```

**运行在**: `http://localhost:5173`

## 📊 索引测试数据

启动所有服务后，索引示例文档：

```bash
cd backend/python
source venv/bin/activate  # 激活虚拟环境
python index_sample_data.py
```

这会索引10个示例文档用于测试搜索功能。

## ✅ 验证服务状态

### 检查所有服务

```bash
# PostgreSQL
docker ps | grep verdant_postgres

# Python API
curl http://localhost:8001/health

# Go API
curl http://localhost:8080/health

# Frontend
# 浏览器打开 http://localhost:5173
```

### 检查数据库

```bash
# 查看文档数量
docker exec -it verdant_postgres psql -U verdant -d verdant_search -c "SELECT COUNT(*) FROM documents;"

# 查看用户数量
docker exec -it verdant_postgres psql -U verdant -d verdant_search -c "SELECT COUNT(*) FROM users;"
```

## 🎯 使用流程

1. **打开浏览器** → `http://localhost:5173`
2. **注册账号** → 点击"Register"
   - 邮箱格式：`test@example.com`
   - 密码至少6位
3. **搜索测试** → 输入查询词如"machine learning"
4. **查看历史** → 点击右上角头像 → Search History

## 🔍 功能特性

### 混合搜索
- ✅ **BM25关键词匹配** (40%权重)
- ✅ **向量语义搜索** (60%权重) 
- ✅ **中文分词** (jieba)
- ✅ **HNSW快速检索**

### 用户功能
- ✅ 用户注册/登录（JWT认证）
- ✅ 搜索历史记录
- ✅ 个人资料显示

### API端点

**Go Backend (8080)**:
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/search?q=query` - 搜索
- `GET /api/history` - 历史记录

**Python API (8001)**:
- `POST /api/search` - 混合搜索
- `POST /api/index` - 索引文档
- `POST /api/tokenize` - 分词测试
- `GET /api/documents` - 列出文档

## 📝 数据库信息

**PostgreSQL连接信息**:
- Host: `localhost`
- Port: `5432`
- Database: `verdant_search`
- User: `verdant`
- Password: `verdant123`

**数据表**:
- `users` - 用户信息
- `search_histories` - 搜索历史
- `documents` - 文档内容（分词后）
- `document_embeddings` - 向量索引

## 🐛 常见问题

### PostgreSQL无法启动
```bash
docker-compose down
docker-compose up -d
docker logs verdant_postgres
```

### Python依赖安装失败
```bash
# 更新pip
pip install --upgrade pip

# 如果torch安装慢，使用国内源
pip install torch -i https://pypi.tuna.tsinghua.edu.cn/simple

# 重新安装
pip install -r requirements.txt
```

### Go无法连接数据库
```bash
# 确认PostgreSQL运行
docker ps | grep verdant_postgres

# 安装PostgreSQL驱动
cd backend/go
go get gorm.io/driver/postgres
```

### 搜索返回空结果
```bash
# 1. 检查是否已索引数据
curl http://localhost:8001/api/documents

# 2. 如果没有，运行索引脚本
cd backend/python
python index_sample_data.py

# 3. 检查Python API日志
# 查看终端输出
```

### 端口被占用
修改配置文件中的端口：
- Go: 修改环境变量 `PORT`
- Python: 修改 `backend/python/config.py` 中的 `PORT`
- Frontend: 修改 `frontend/vite.config.js`

## 📁 项目结构

```
verdant_search/
├── frontend/              # React前端
├── backend/
│   ├── go/               # Go Gin API（认证、历史）
│   └── python/           # Python搜索引擎（BM25+向量）
├── docker-compose.yml    # PostgreSQL配置
├── init.sql             # 数据库初始化脚本
├── start.sh             # 启动脚本
├── stop.sh              # 停止脚本
└── README.md            # 本文件
```

## 🔧 开发模式

### 实时日志查看

```bash
# 所有服务日志（如果使用start.sh）
tail -f logs/*.log

# 单独查看
tail -f logs/python.log
tail -f logs/go.log
tail -f logs/frontend.log
```

### 热重载

- **Frontend**: Vite自动热重载
- **Python**: `uvicorn --reload`已启用
- **Go**: 使用`air`工具（需要安装）

## 📚 下一步

1. ✅ 索引你自己的数据（使用`/api/index`）
2. ✅ 调整BM25和向量权重（`backend/python/config.py`）
3. ✅ 添加更多过滤器（日期、来源等）
4. ✅ 实现图片搜索（CLIP支持）
5. ✅ 部署到生产环境

## 🎉 完成！

现在访问 **http://localhost:5173** 开始搜索吧！

有问题查看日志或提issue。

---

**Happy Searching!** 🚀
