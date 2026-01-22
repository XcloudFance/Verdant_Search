#!/usr/bin/env python3
"""
清理 "The heart of the internet" 数据并重新爬取

功能:
1. 从数据库找到所有 title="The heart of the internet" 的文档
2. 提取这些文档的 URL
3. 将 URL 添加到 Redis 爬虫队列的**头部**（优先爬取）
4. 从数据库**彻底删除**这些文档及相关数据
"""

import asyncio
import sys
import os
import redis
import json

# 添加 python 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'python'))

from sqlalchemy import text
from database import AsyncSessionLocal

# Redis 配置
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_CRAWLER_DB = 1
TASK_QUEUE_KEY = "crawler:task_queue"


async def find_bad_documents():
    """查找所有 title 包含 'The heart of the internet' 的文档"""
    print("🔍 查找需要重新爬取的文档...")
    
    async with AsyncSessionLocal() as session:
        query = text("""
            SELECT id, title, url, created_at
            FROM documents
            WHERE title = 'The heart of the internet'
            OR title LIKE '%heart of the internet%'
            ORDER BY id
        """)
        
        result = await session.execute(query)
        docs = result.fetchall()
        
        return [
            {
                'id': row[0],
                'title': row[1],
                'url': row[2],
                'created_at': str(row[3])
            }
            for row in docs
        ]


async def delete_document_completely(doc_id: int, session):
    """完全删除文档及其所有相关数据"""
    # 1. 删除 postings (会自动通过 CASCADE 删除)
    # 2. 删除 embeddings (会自动通过 CASCADE 删除)
    # 3. 删除 document
    
    delete_query = text("""
        DELETE FROM documents WHERE id = :doc_id
    """)
    
    await session.execute(delete_query, {"doc_id": doc_id})


async def delete_bad_documents(doc_ids: list):
    """批量删除文档"""
    print(f"🗑️  开始删除 {len(doc_ids)} 个文档...")
    
    async with AsyncSessionLocal() as session:
        deleted = 0
        for doc_id in doc_ids:
            try:
                await delete_document_completely(doc_id, session)
                deleted += 1
                if deleted % 10 == 0:
                    print(f"   已删除 {deleted}/{len(doc_ids)}...")
            except Exception as e:
                print(f"   ❌ 删除文档 {doc_id} 失败: {e}")
        
        await session.commit()
        print(f"✅ 成功删除 {deleted} 个文档")


def add_urls_to_queue_head(urls: list):
    """将 URL 添加到 Redis 队列头部（使用 LPUSH）"""
    print(f"📥 将 {len(urls)} 个 URL 添加到爬虫队列头部...")
    
    try:
        r = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_CRAWLER_DB,
            decode_responses=True
        )
        
        # 使用 LPUSH 添加到队列头部（优先爬取）
        added = 0
        for url in urls:
            if url:  # 确保 URL 不为空
                task = json.dumps({
                    'url': url,
                    'depth': 0  # 重置深度
                })
                r.lpush(TASK_QUEUE_KEY, task)
                added += 1
        
        print(f"✅ 成功添加 {added} 个 URL 到队列头部")
        
        # 显示队列状态
        queue_size = r.llen(TASK_QUEUE_KEY)
        print(f"📊 当前队列大小: {queue_size}")
        
    except Exception as e:
        print(f"❌ 添加到 Redis 失败: {e}")
        raise


async def main():
    """主函数"""
    print("=" * 70)
    print("清理并重新爬取脚本")
    print("=" * 70)
    print()
    
    # 1. 查找需要处理的文档
    bad_docs = await find_bad_documents()
    
    if not bad_docs:
        print("✅ 没有找到需要重新爬取的文档！")
        return
    
    print(f"\n找到 {len(bad_docs)} 个需要重新爬取的文档:")
    print()
    
    # 显示前10个
    for i, doc in enumerate(bad_docs[:10], 1):
        print(f"  {i}. ID={doc['id']}: {doc['url'][:80]}")
    
    if len(bad_docs) > 10:
        print(f"  ... 还有 {len(bad_docs) - 10} 个")
    
    print()
    
    # 确认
    response = input(f"❓ 确认要删除这 {len(bad_docs)} 个文档并重新爬取吗? [y/N] ")
    if response.lower() != 'y':
        print("❌ 已取消")
        return
    
    print()
    
    # 2. 提取 URL
    urls = [doc['url'] for doc in bad_docs if doc.get('url')]
    print(f"📋 提取了 {len(urls)} 个有效 URL")
    
    # 3. 添加到 Redis 队列头部
    add_urls_to_queue_head(urls)
    print()
    
    # 4. 删除文档
    doc_ids = [doc['id'] for doc in bad_docs]
    await delete_bad_documents(doc_ids)
    print()
    
    print("=" * 70)
    print("✅ 清理完成！")
    print()
    print("📌 下一步:")
    print("   1. 启动爬虫: cd /home/lancelot/verdant_search/backend/crawler && ./start_crawler.sh")
    print("   2. 爬虫会优先处理这些 URL（它们在队列头部）")
    print("   3. 浏览器会显示（headful 模式），可以看到爬取过程")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
