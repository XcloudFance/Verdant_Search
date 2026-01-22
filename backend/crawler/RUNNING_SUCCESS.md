# 🎉 爬虫成功运行！

## ✅ 已解决的问题

1. **配置文件冲突** - 重命名为 `crawler_config.py`
2. **DrissionPage API** - 使用正确的超时设置方法
3. **代码完整性** - 恢复所有类方法

## ⚠️ 数据库并发优化

### 问题
多个worker并发写入导致数据库死锁：
- `DeadlockDetectedError`: 进程间锁竞争
- `InterfaceError`: 异步操作冲突

### 解决方案
已应用以下优化：

1. **减少并发数**: `10 → 3` workers
2. **增加延迟**: `0.5s → 1.0s` 请求间隔
3. **推荐配置**: 根据机器性能调整

## 📊 性能建议

### 并发数建议

| CPU核心 | 推荐Workers | 说明 |
|---------|-------------|------|
| 2-4核 | 2-3 | 稳定优先 |
| 4-8核 | 3-5 | 平衡性能 |
| 8+核 | 5-8 | 高性能 |

### 自定义并发数

```bash
# 方法1: 环境变量
export CRAWLER_WORKERS=5
./start_crawler.sh

# 方法2: 直接指定
python main.py --workers 5 --seeds https://www.example.com/
```

## 🚀 使用建议

### 1. 小规模爬取（推荐新手）
```bash
cd /home/lancelot/verdant_search/backend/crawler
./start_crawler.sh  # 默认3个workers
```

### 2. 中等规模爬取
```bash
export CRAWLER_WORKERS=5
./start_crawler.sh
```

### 3. 大规模爬取
```bash
# 增加worker和延迟
export CRAWLER_WORKERS=8
# 编辑 crawler_config.py: REQUEST_DELAY = 1.5
./start_crawler.sh
```

## 📝 监控

查看爬虫状态：
```bash
python main.py --stats
```

查看数据库：
```bash
docker exec -it verdant_postgres psql -U verdant -d verdant_search
SELECT COUNT(*), source_type FROM documents GROUP BY source_type;
```

## 🎯 当前配置

- **Workers**: 3 (默认)
- **Mode**: Session (快速)
- **Delay**: 1.0秒
- **Redis DB**: 1
- **Max Depth**: 不限制

## 💡 故障排查

### 仍然遇到死锁
1. 进一步减少workers: `export CRAWLER_WORKERS=2`
2. 增加延迟: 编辑 `crawler_config.py` 中的 `REQUEST_DELAY`

### 爬取速度太慢
1. 适当增加workers（但不超过5）
2. 减少延迟（但不低于0.5秒）

### 内存占用高
1. 减少workers
2. 考虑增加 `MAX_DEPTH` 限制

## 🎊 开始爬取

```bash
cd /home/lancelot/verdant_search/backend/crawler
./start_crawler.sh
```

输入你想爬取的URL，享受专业级网页爬虫！
