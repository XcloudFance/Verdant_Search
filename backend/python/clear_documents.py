"""
清空所有索引的文档
在重新索引之前使用
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import AsyncSessionLocal, init_db
from sqlalchemy import text

async def clear_all_documents():
    """清空所有文档及相关数据"""
    await init_db()
    print("=" * 60)
    print("清空文档数据库")
    print("=" * 60)
    
    async with AsyncSessionLocal() as session:
        try:
            # 获取文档数量
            result = await session.execute(text("SELECT COUNT(*) FROM documents"))
            count = result.scalar()
            print(f"\n当前文档数量: {count}")
            
            if count == 0:
                print("\n数据库已经是空的！")
                return
            
            print("\n开始清空...")
            
            # 清空相关表（按照外键依赖顺序）
            await session.execute(text("DELETE FROM postings"))
            print("✓ 清空 postings 表")
            
            await session.execute(text("DELETE FROM document_embeddings"))
            print("✓ 清空 document_embeddings 表")
            
            await session.execute(text("DELETE FROM documents"))
            print("✓ 清空 documents 表")
            
            await session.execute(text("DELETE FROM terms"))
            print("✓ 清空 terms 表")
            
            await session.execute(text("DELETE FROM doc_stats"))
            print("✓ 清空 doc_stats 表")
            
            await session.commit()
            
            print("\n" + "=" * 60)
            print("✓ 数据库清空完成！")
            print("=" * 60)
            print("\n现在可以重新索引数据了：")
            print("  python index_csv_data.py")
            
        except Exception as e:
            await session.rollback()
            print(f"\n✗ 清空失败: {str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(clear_all_documents())

