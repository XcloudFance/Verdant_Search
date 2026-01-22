#!/usr/bin/env python3
"""
清理所有搜索引擎数据
- 删除所有数据库表
- 清空 Redis 爬虫数据
- 重新创建数据库表
"""
import asyncio
import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine
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
    print("\n" + "="*60)
    print("🗑️  删除所有数据库表...")
    print("="*60)
    
    async with engine.begin() as conn:
        # 删除所有表
        await conn.run_sync(Base.metadata.drop_all)
        print("✅ 所有表已删除")

async def create_all_tables():
    """重新创建所有数据库表"""
    print("\n" + "="*60)
    print("🔨 重新创建数据库表...")
    print("="*60)
    
    async with engine.begin() as conn:
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
        print("✅ 所有表已创建")

def clear_redis_data():
    """清空 Redis 中的爬虫数据"""
    print("\n" + "="*60)
    print("🧹 清空 Redis 爬虫数据...")
    print("="*60)
    
    try:
        # 连接 Redis
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_CRAWLER_DB,
            password=REDIS_PASSWORD if REDIS_PASSWORD else None,
            decode_responses=False
        )
        
        # 检查连接
        redis_client.ping()
        print(f"✅ 已连接到 Redis: {REDIS_HOST}:{REDIS_PORT}/{REDIS_CRAWLER_DB}")
        
        # 获取所有爬虫相关的键
        crawler_keys = redis_client.keys("crawler:*")
        
        if crawler_keys:
            print(f"\n找到 {len(crawler_keys)} 个爬虫相关的键:")
            for key in crawler_keys[:10]:  # 只显示前10个
                key_str = key.decode('utf-8') if isinstance(key, bytes) else key
                print(f"  - {key_str}")
            if len(crawler_keys) > 10:
                print(f"  ... 还有 {len(crawler_keys) - 10} 个键")
            
            # 删除所有爬虫键
            deleted = redis_client.delete(*crawler_keys)
            print(f"\n✅ 已删除 {deleted} 个 Redis 键")
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
    print("\n" + "="*60)
    print("🔍 验证清理结果...")
    print("="*60)
    
    async with AsyncSessionLocal() as session:
        # 检查每个表
        from sqlalchemy import text
        
        tables = ["documents", "document_embeddings", "terms", "postings", "doc_stats"]
        
        for table in tables:
            result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            print(f"  - {table}: {count} 行")
        
        print("\n✅ 验证完成")

async def main():
    """主函数"""
    print("\n" + "="*60)
    print("⚠️  警告：即将删除所有搜索引擎数据！")
    print("="*60)
    print("\n这将会：")
    print("  1. 删除所有数据库表（documents, embeddings, terms, postings, doc_stats）")
    print("  2. 清空 Redis 中的爬虫数据（Bloomfilter, 任务队列等）")
    print("  3. 重新创建空的数据库表")
    print("\n⚠️  此操作不可逆！所有已爬取的数据将永久丢失！\n")
    
    # 确认
    confirm = input("确认要继续吗？输入 'yes' 继续，其他任何输入取消: ")
    
    if confirm.lower() != 'yes':
        print("\n❌ 操作已取消")
        return
    
    print("\n开始清理...")
    
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
