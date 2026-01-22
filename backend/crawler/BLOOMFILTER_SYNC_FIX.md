# Bloomfilter 实时同步修复

## 问题描述

之前的实现中，每个爬虫 worker 都有自己独立的 Bloomfilter 内存副本：
- Worker 0 标记 URL A 为已访问（仅在自己的内存中）
- Worker 1 不知道 URL A 已被访问，继续处理
- 导致同一个 URL 被多次爬取和索引

## 解决方案

修改 `url_manager.py`，实现 Bloomfilter 的实时 Redis 同步：

### 1. `is_visited()` - 实时检查
- 每次检查时从 Redis 加载最新的 Bloomfilter
- 确保所有 worker 看到的是同一个状态

### 2. `mark_visited()` - 实时标记
- 使用 Redis 分布式锁确保原子性
- 加载最新 Bloomfilter → 添加 URL → 保存回 Redis
- 避免并发写入导致的数据丢失

### 3. `get_visited_count()` - 实时计数
- 从 Redis 加载 Bloomfilter 并返回准确计数

## 性能考虑

虽然实时同步会增加 Redis 操作，但：
- ✅ 避免了重复爬取（节省大量网络和计算资源）
- ✅ 避免了数据库中的重复记录
- ✅ 使用 Redis 锁保证数据一致性
- ⚠️ 每次标记 URL 需要序列化/反序列化 Bloomfilter（可接受的开销）

## 使用方式

无需修改使用方式，爬虫会自动使用新的实时同步机制：

```bash
bash start_crawler.sh <URL>
```

现在多个 worker 之间会正确共享 Bloomfilter，不会重复爬取相同的 URL。

## 技术细节

- **Redis 锁**: 使用 `redis.lock()` 确保同一时间只有一个 worker 修改 Bloomfilter
- **锁超时**: 5 秒（防止死锁）
- **阻塞超时**: 10 秒（等待锁的最长时间）
- **降级策略**: 如果 Redis 操作失败，使用本地缓存的 Bloomfilter

## 修复日期

2026-01-11
