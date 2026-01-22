#!/usr/bin/env python3
"""
清理所有搜索引擎数据（自动执行版本）
"""
import asyncio
import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from database import engine, AsyncSessionLocal
from models import Base
import redis

# 导入爬虫配置
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'crawler'))
from crawler_config import (
    REDIS_HOST, REDIS_PORT, REDIS_CRAWLER_DB, REDIS_PASSWORD,
    BLOOMFILTER_KEY, TASK_QUEUE_KEY
)

async def drop_all_tables():
    """删除所有数据库表"""
    print("\n🗑️  删除所有数据库表...")
    
    async with engine.begin() as conn:
        # 使用 CASCADE 删除所有表及其依赖
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        print("✅ 所有表已删除")

async def create_all_tables():
    """重新创建所有数据库表"""
    print("\n🔨 重新创建数据库表...")
    
    async with engine.begin() as conn:
        # 先创建 pgvector 扩展
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
        print("✅ 所有表已创建")

def clear_redis_data():
    """清空 Redis 中的爬虫数据"""
    print("\n🧹 清空 Redis 爬虫数据...")
    
    try:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_CRAWLER_DB,
            password=REDIS_PASSWORD if REDIS_PASSWORD else None,
            decode_responses=False
        )
        
        redis_client.ping()
        print(f"✅ 已连接到 Redis: {REDIS_HOST}:{REDIS_PORT}/{REDIS_CRAWLER_DB}")
        
        # 获取所有爬虫相关的键
        crawler_keys = redis_client.keys("crawler:*")
        
        if crawler_keys:
            print(f"找到 {len(crawler_keys)} 个爬虫相关的键")
            deleted = redis_client.delete(*crawler_keys)
            print(f"✅ 已删除 {deleted} 个 Redis 键")
        else:
            print("ℹ️  没有找到爬虫相关的 Redis 键")
        
        # 额外确保删除 Bloomfilter 和任务队列
        redis_client.delete(BLOOMFILTER_KEY)
        redis_client.delete(TASK_QUEUE_KEY)
        
        print("✅ Redis 数据已清空")
        
    except Exception as e:
        print(f"❌ 清空 Redis 数据失败: {e}")
        raise

async def verify_cleanup():
    """验证清理结果"""
    print("\n🔍 验证清理结果...")
    
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        
        tables = ["documents", "document_embeddings", "image_embeddings", "terms", "postings", "doc_stats"]
        
        for table in tables:
            result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            print(f"  - {table}: {count} 行")
        
        print("✅ 验证完成")

async def main():
    """主函数"""
    print("\n" + "="*60)
    print("开始清理所有搜索引擎数据...")
    print("="*60)
    
    try:
        # 1. 删除所有表
        await drop_all_tables()
        
        # 2. 清空 Redis
        clear_redis_data()
        
        # 3. 重新创建表
        await create_all_tables()
        
        # 4. 验证
        await verify_cleanup()
        
        print("\n" + "="*60)
        print("✅ 清理完成！")
        print("="*60)
        print("\n现在可以重新开始爬取数据了。")
        print("使用命令: bash start_crawler.sh <URL>\n")
        
    except Exception as e:
        print(f"\n❌ 清理过程中出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
