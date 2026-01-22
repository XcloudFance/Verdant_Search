# Verdant Search - Complete Startup Guide

A complete hybrid search engine with user authentication, search history, and AI search capabilities.

## 🏗️ System Architecture

```
Frontend (React) 
    ↓
Go Gin Backend (8080)
    ↓
Python FastAPI (8001) 
    ↓
PostgreSQL + pgvector (5432)
```

## 📋 Prerequisites

- **Docker & Docker Compose** - For running PostgreSQL
- **Go 1.21+** - Go backend
- **Python 3.9+** - Python search engine
- **Node.js 18+** - Frontend

## 🚀 Quick Start (Recommended)

### Option 1: Using Startup Script (Easiest)

```bash
# Add execution permissions to scripts
chmod +x start.sh stop.sh

# Start all services
./start.sh

# Stop all services
./stop.sh
```

### Option 2: Manual Startup (Step by Step)

#### Step 1: Start PostgreSQL

```bash
# Start PostgreSQL container
docker-compose up -d

# Check if started successfully
docker ps
docker logs verdant_postgres
```

#### Step 2: Start Python Search API

```bash
cd backend/python

# Create virtual environment (first time)
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# Install dependencies (first time or after updates)
pip install -r requirements.txt

# Start Python API
python main.py
```

**Running on**: `http://localhost:8001`

⚠️ **First run will download CLIP model (~500MB), please be patient**

#### Step 3: Start Go Backend

Open a new terminal:

```bash
cd backend/go

# Install Go dependencies (first time)
go mod download
go get gorm.io/driver/postgres

# Start Go backend
go run main.go
```

**Running on**: `http://localhost:8080`

#### Step 4: Start Frontend

Open another new terminal:

```bash
cd frontend

# Install dependencies (first time)
npm install

# Start frontend
npm run dev
```

**Running on**: `http://localhost:5173`

## 📊 Index Test Data

After starting all services, index sample documents:

```bash
cd backend/python
source venv/bin/activate  # Activate virtual environment
python index_sample_data.py
```

This will index 10 sample documents for testing search functionality.

## ✅ Verify Service Status

### Check All Services

```bash
# PostgreSQL
docker ps | grep verdant_postgres

# Python API
curl http://localhost:8001/health

# Go API
curl http://localhost:8080/health

# Frontend
# Open browser at http://localhost:5173
```

### Check Database

```bash
# View document count
docker exec -it verdant_postgres psql -U verdant -d verdant_search -c "SELECT COUNT(*) FROM documents;"

# View user count
docker exec -it verdant_postgres psql -U verdant -d verdant_search -c "SELECT COUNT(*) FROM users;"
```

## 🎯 Usage Flow

1. **Open browser** → `http://localhost:5173`
2. **Register account** → Click "Register"
   - Email format: `test@example.com`
   - Password minimum 6 characters
3. **Test search** → Enter query like "machine learning"
4. **View history** → Click avatar in top right → Search History

## 🔍 Features

### Hybrid Search
- ✅ **BM25 keyword matching** (40% weight)
- ✅ **Vector semantic search** (60% weight) 
- ✅ **Chinese word segmentation** (jieba)
- ✅ **HNSW fast retrieval**

### User Features
- ✅ User registration/login (JWT authentication)
- ✅ Search history tracking
- ✅ Personal profile display

### API Endpoints

**Go Backend (8080)**:
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/search?q=query` - Search
- `GET /api/history` - History

**Python API (8001)**:
- `POST /api/search` - Hybrid search
- `POST /api/index` - Index documents
- `POST /api/tokenize` - Tokenization test
- `GET /api/documents` - List documents

## 📝 Database Information

**PostgreSQL Connection**:
- Host: `localhost`
- Port: `5432`
- Database: `verdant_search`
- User: `verdant`
- Password: `verdant123`

**Tables**:
- `users` - User information
- `search_histories` - Search history
- `documents` - Document content (tokenized)
- `document_embeddings` - Vector index

## 🐛 Common Issues

### PostgreSQL Won't Start
```bash
docker-compose down
docker-compose up -d
docker logs verdant_postgres
```

### Python Dependencies Installation Failed
```bash
# Update pip
pip install --upgrade pip

# If torch installation is slow, use Chinese mirror
pip install torch -i https://pypi.tuna.tsinghua.edu.cn/simple

# Reinstall
pip install -r requirements.txt
```

### Go Cannot Connect to Database
```bash
# Confirm PostgreSQL is running
docker ps | grep verdant_postgres

# Install PostgreSQL driver
cd backend/go
go get gorm.io/driver/postgres
```

### Search Returns Empty Results
```bash
# 1. Check if data is indexed
curl http://localhost:8001/api/documents

# 2. If not, run indexing script
cd backend/python
python index_sample_data.py

# 3. Check Python API logs
# View terminal output
```

### Port Already in Use
Modify ports in configuration files:
- Go: Modify `PORT` environment variable
- Python: Modify `PORT` in `backend/python/config.py`
- Frontend: Modify `frontend/vite.config.js`

## 📁 Project Structure

```
verdant_search/
├── frontend/              # React frontend
├── backend/
│   ├── go/               # Go Gin API (auth, history)
│   └── python/           # Python search engine (BM25+vector)
├── docker-compose.yml    # PostgreSQL configuration
├── init.sql             # Database initialization script
├── start.sh             # Startup script
├── stop.sh              # Stop script
└── README.md            # This file
```

## 🔧 Development Mode

### Real-time Log Viewing

```bash
# All service logs (if using start.sh)
tail -f logs/*.log

# View individually
tail -f logs/python.log
tail -f logs/go.log
tail -f logs/frontend.log
```

### Hot Reload

- **Frontend**: Vite automatic hot reload
- **Python**: `uvicorn --reload` enabled
- **Go**: Use `air` tool (requires installation)

## 📚 Next Steps

1. ✅ Index your own data (use `/api/index`)
2. ✅ Adjust BM25 and vector weights (`backend/python/config.py`)
3. ✅ Add more filters (date, source, etc.)
4. ✅ Implement image search (CLIP support)
5. ✅ Deploy to production

## 🎉 Done!

Now visit **http://localhost:5173** to start searching!

Check logs or submit an issue if you have problems.

---

**Happy Searching!** 🚀
