#!/usr/bin/env python3
"""
Terms 统计信息批量更新脚本

用途：
- 定期批量更新 terms 表的 doc_frequency 和 total_frequency
- 更新 doc_stats 表的全局统计信息
- 避免在插入 posting 时实时更新导致的死锁问题

使用方式：
1. 手动运行: python update_term_stats.py
2. 定时任务: crontab -e 添加 */5 * * * * cd /path/to/backend/python && python3 update_term_stats.py
"""

import asyncio
import sys
import os
from sqlalchemy import text
from database import AsyncSessionLocal

async def update_term_stats():
    """批量更新 terms 表的统计信息"""
    print("🔄 开始更新 terms 统计...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. 批量更新所有 terms 的 doc_frequency 和 total_frequency
            update_terms_query = text("""
                UPDATE terms t
                SET 
                    doc_frequency = COALESCE(p.doc_count, 0),
                    total_frequency = COALESCE(p.total_freq, 0)
                FROM (
                    SELECT 
                        term_id,
                        COUNT(DISTINCT document_id) as doc_count,
                        SUM(term_frequency) as total_freq
                    FROM postings
                    GROUP BY term_id
                ) p
                WHERE t.id = p.term_id
            """)
            
            result = await session.execute(update_terms_query)
            updated_count = result.rowcount
            
            await session.commit()
            print(f"✅ 更新了 {updated_count} 个 terms 的统计信息")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ 更新 terms 统计失败: {e}")
            raise

async def update_doc_stats():
    """更新全局文档统计信息"""
    print("🔄 开始更新文档统计...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 计算总文档数和平均文档长度
            stats_query = text("""
                SELECT 
                    COUNT(*) as total_docs,
                    COALESCE(AVG(doc_length), 0) as avg_doc_length
                FROM documents
                WHERE doc_length > 0
            """)
            result = await session.execute(stats_query)
            row = result.first()
            
            if row:
                total_docs, avg_doc_length = row[0], row[1]
                
                # 更新 doc_stats 表
                update_query = text("""
                    INSERT INTO doc_stats (id, total_docs, avg_doc_length, updated_at)
                    VALUES (1, :total_docs, :avg_doc_length, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) 
                    DO UPDATE SET 
                        total_docs = :total_docs,
                        avg_doc_length = :avg_doc_length,
                        updated_at = CURRENT_TIMESTAMP
                """)
                await session.execute(update_query, {
                    "total_docs": total_docs,
                    "avg_doc_length": avg_doc_length
                })
                
                await session.commit()
                print(f"✅ 文档统计更新: total_docs={total_docs}, avg_doc_length={avg_doc_length:.2f}")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ 更新文档统计失败: {e}")
            raise

async def cleanup_orphaned_terms():
    """清理没有任何 posting 的孤立 terms"""
    print("🔄 开始清理孤立 terms...")
    
    async with AsyncSessionLocal() as session:
        try:
            cleanup_query = text("""
                DELETE FROM terms 
                WHERE id NOT IN (SELECT DISTINCT term_id FROM postings)
            """)
            result = await session.execute(cleanup_query)
            deleted_count = result.rowcount
            
            await session.commit()
            
            if deleted_count > 0:
                print(f"✅ 清理了 {deleted_count} 个孤立 terms")
            else:
                print("✅ 没有需要清理的孤立 terms")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ 清理孤立 terms 失败: {e}")
            raise

async def main():
    """主函数"""
    print("=" * 60)
    print("Terms 统计信息更新任务")
    print("=" * 60)
    print()
    
    try:
        # 1. 更新 terms 统计
        await update_term_stats()
        print()
        
        # 2. 更新文档统计
        await update_doc_stats()
        print()
        
        # 3. 清理孤立 terms
        await cleanup_orphaned_terms()
        print()
        
        print("=" * 60)
        print("✅ 所有统计信息更新完成！")
        print("=" * 60)
        
    except Exception as e:
        print()
        print("=" * 60)
        print(f"❌ 更新失败: {e}")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
