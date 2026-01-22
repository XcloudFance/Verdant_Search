#!/bin/bash
# 爬虫快速启动脚本

# 设置工作目录
cd "$(dirname "$0")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Verdant Search Web Crawler${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 检查Redis是否运行
echo -e "${YELLOW}检查 Redis 服务...${NC}"
if ! docker exec verdant_redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}错误: Redis 未运行!${NC}"
    echo -e "${YELLOW}提示: 请先运行主项目启动脚本: ./start.sh${NC}"
    echo -e "${YELLOW}或手动启动: docker-compose up -d${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Redis 运行正常${NC}"
echo ""

# 检查PostgreSQL连接
echo -e "${YELLOW}检查 PostgreSQL 连接...${NC}"
if ! docker exec verdant_postgres pg_isready -U verdant > /dev/null 2>&1; then
    echo -e "${RED}错误: PostgreSQL 未运行!${NC}"
    echo -e "${YELLOW}提示: 请先运行主项目启动脚本: ./start.sh${NC}"
    echo -e "${YELLOW}或手动启动: docker-compose up -d${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL 运行正常${NC}"
echo ""


# 检查依赖
echo -e "${YELLOW}检查依赖...${NC}"
if ! python3 -c "
from DrissionPage import SessionPage
import trafilatura
import redis
from pybloom_live import BloomFilter
print('OK')
" > /dev/null 2>&1; then
    echo -e "${RED}错误: 缺少依赖包!${NC}"
    echo -e "${YELLOW}正在安装依赖...${NC}"
    pip install DrissionPage trafilatura readability-lxml redis pybloom-live lxml
fi
echo -e "${GREEN}✓ 依赖检查完成${NC}"
echo ""

# 默认参数
WORKERS=${CRAWLER_WORKERS:-3}

# 检查 Redis 队列是否有任务
echo -e "${YELLOW}检查任务队列...${NC}"
QUEUE_SIZE=$(docker exec verdant_redis redis-cli -n 1 LLEN crawler:task_queue 2>/dev/null || echo "0")

if [ "$QUEUE_SIZE" -gt 0 ]; then
    echo -e "${GREEN}✓ 发现队列中有 ${QUEUE_SIZE} 个任务${NC}"
    echo -e "${YELLOW}将从上次中断处继续爬取${NC}"
    SEEDS=""  # 不需要种子URL
else
    echo -e "${YELLOW}队列为空，需要提供种子URL${NC}"
    
    # 检查是否有命令行参数
    if [ $# -gt 0 ]; then
        SEEDS="$@"
    else
        # 如果没有参数，询问用户
        echo -e "${YELLOW}请输入种子URL（多个URL用空格分隔）:${NC}"
        echo -e "${YELLOW}示例: https://www.python.org/ https://docs.python.org/${NC}"
        read -p "> " SEEDS
        
        # 如果用户没输入，使用默认值
        if [ -z "$SEEDS" ]; then
            SEEDS="https://www.python.org/"
            echo -e "${YELLOW}使用默认种子URL: ${SEEDS}${NC}\""
        fi
    fi
fi

# 显示配置
echo ""
echo -e "${GREEN}配置信息:${NC}"
echo -e "  并发线程数: ${WORKERS}"
if [ -n "$SEEDS" ]; then
    echo -e "  种子URL: ${SEEDS}"
else
    echo -e "  模式: 从队列继续（${QUEUE_SIZE} 个任务）"
fi
echo ""

# 询问是否清空之前的数据
read -p "是否清空之前的爬虫数据? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}清空爬虫数据...${NC}"
    python3 main.py --clear
    echo -e "${GREEN}✓ 数据已清空${NC}"
    echo ""
fi

# 启动爬虫
echo -e "${GREEN}启动爬虫...${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止爬虫${NC}"
echo ""

# 根据是否有种子URL决定启动命令
if [ -n "$SEEDS" ]; then
    exec python3 main.py --workers $WORKERS --seeds $SEEDS
else
    exec python3 main.py --workers $WORKERS
fi
