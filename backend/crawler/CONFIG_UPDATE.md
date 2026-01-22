# 🔧 爬虫配置已更新

## ✅ 已完成的配置调整

根据你的 `docker-compose.yml` 和 `start.sh`，我已经调整了爬虫配置：

### 1. 添加 Redis 到 docker-compose.yml

```yaml
redis:
  image: redis:7-alpine
  container_name: verdant_redis
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

现在 `docker-compose up -d` 会同时启动：
- ✅ PostgreSQL (verdant_postgres)
- ✅ Redis (verdant_redis)

### 2. 更新爬虫配置

**backend/crawler/config.py**:
- ✅ Redis 配置与主项目一致
- ✅ 使用 DB 1（避免与缓存的 DB 0 冲突）
- ✅ 连接到 localhost:6379

**backend/crawler/url_manager.py**:
- ✅ 修复了变量名 `REDIS_CRAWLER_DB`
- ✅ 正确连接到 Redis DB 1

### 3. 更新启动脚本

**backend/crawler/start_crawler.sh**:
- ✅ 检查 Redis 是否运行（docker）
- ✅ 检查 PostgreSQL 是否运行（docker）
- ✅ 提示用户先运行 `./start.sh`

## 🚀 正确的启动流程

### 步骤1: 启动主项目（包含数据库）

```bash
cd /home/lancelot/verdant_search
./start.sh
```

这会启动：
- PostgreSQL (docker)
- Redis (docker)
- Python API
- Go API
- Frontend

### 步骤2: 启动爬虫（新终端）

```bash
cd /home/lancelot/verdant_search/backend/crawler
./start_crawler.sh
```

或者直接：

```bash
python main.py --seeds https://www.python.org/
```

## 📋 配置说明

### Redis 数据库分配

- **DB 0**: 主项目缓存（cache_service.py）
- **DB 1**: 爬虫数据（Bloomfilter + 任务队列）

这样两者不会冲突！

### 数据库连接

爬虫使用与主项目相同的 PostgreSQL 配置：
- Host: localhost
- Port: 5432
- User: verdant
- Password: verdant123
- Database: verdant_search

## ✨ 现在可以使用了！

```bash
# 终端1 - 启动主项目
cd /home/lancelot/verdant_search
./start.sh

# 终端2 - 启动爬虫
cd /home/lancelot/verdant_search/backend/crawler
./start_crawler.sh
```

爬虫会自动：
1. 检查 Redis 和 PostgreSQL 是否运行
2. 检查依赖包
3. 询问是否清空旧数据
4. 开始爬取并索引到数据库

## 🎯 验证

启动后你可以：

1. **查看爬虫状态**:
   ```bash
   python main.py --stats
   ```

2. **查看数据库**:
   ```bash
   docker exec -it verdant_postgres psql -U verdant -d verdant_search
   SELECT COUNT(*) FROM documents WHERE source_type = 'web';
   ```

3. **查看 Redis**:
   ```bash
   redis-cli
   SELECT 1
   KEYS crawler:*
   ```

完成！🎉
