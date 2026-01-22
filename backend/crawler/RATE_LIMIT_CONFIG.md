# 爬虫限速配置说明

## 概述

爬虫现在支持灵活的限速配置，所有限速相关的设置都已移至 `crawler_config.py` 文件中。

## 配置项

### 1. ENABLE_RATE_LIMIT (限速开关)
- **默认值**: `true`
- **环境变量**: `ENABLE_RATE_LIMIT`
- **说明**: 控制是否启用全局限速功能
- **可选值**: 
  - `true`, `1`, `yes` - 启用限速
  - `false`, `0`, `no` - 禁用限速

### 2. REQUESTS_PER_BATCH (批次请求数)
- **默认值**: `10`
- **环境变量**: `REQUESTS_PER_BATCH`
- **说明**: 每批次允许处理的请求数量，达到此数量后会触发休息

### 3. BATCH_REST_DURATION (休息时长)
- **默认值**: `60` (秒)
- **环境变量**: `BATCH_REST_DURATION`
- **说明**: 每批次请求完成后的休息时长

## 使用方法

### 方法一：通过环境变量配置

```bash
# 禁用限速
export ENABLE_RATE_LIMIT=false
bash start_crawler.sh <URL>

# 或者在启动命令中直接设置
ENABLE_RATE_LIMIT=false bash start_crawler.sh <URL>

# 启用限速并自定义参数
ENABLE_RATE_LIMIT=true REQUESTS_PER_BATCH=20 BATCH_REST_DURATION=30 bash start_crawler.sh <URL>
```

### 方法二：直接修改配置文件

编辑 `crawler_config.py` 文件：

```python
# 全局限速配置
ENABLE_RATE_LIMIT = False  # 关闭限速
REQUESTS_PER_BATCH = 20    # 每批20个请求
BATCH_REST_DURATION = 30   # 休息30秒
```

## 使用场景

### 启用限速（推荐）
- 爬取公共网站时，避免对目标服务器造成过大压力
- 防止被目标网站封禁IP
- 遵守网站的爬虫礼仪

### 禁用限速
- 爬取自己的网站或有授权的网站
- 在测试环境中快速验证爬虫功能
- 需要快速完成爬取任务且已获得许可

## 注意事项

⚠️ **重要提醒**：
1. 禁用限速可能会对目标服务器造成较大负载，请谨慎使用
2. 某些网站可能会因为请求过快而封禁IP地址
3. 建议在生产环境中始终启用限速功能
4. 如果需要提高爬取速度，建议适当增加 `REQUESTS_PER_BATCH` 而不是完全禁用限速

## 示例

### 示例1：快速测试（禁用限速）
```bash
ENABLE_RATE_LIMIT=false bash start_crawler.sh https://example.com
```

### 示例2：温和爬取（默认配置）
```bash
# 使用默认配置：每10个请求休息60秒
bash start_crawler.sh https://example.com
```

### 示例3：自定义限速
```bash
# 每50个请求休息120秒
REQUESTS_PER_BATCH=50 BATCH_REST_DURATION=120 bash start_crawler.sh https://example.com
```

## 技术实现

限速功能通过 Redis 实现分布式计数和同步，确保多个爬虫进程之间能够协调工作：

1. 每个请求都会递增 Redis 中的全局计数器
2. 当计数器达到 `REQUESTS_PER_BATCH` 时，设置休息时间戳
3. 所有进程检测到休息时间戳后会同步休息
4. 休息结束后重置计数器，继续爬取

当 `ENABLE_RATE_LIMIT=false` 时，`check_and_rest_if_needed()` 方法会直接返回，完全跳过限速逻辑。
