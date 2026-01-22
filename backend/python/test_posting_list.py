"""
测试自定义Posting List和BM25算法
"""
import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal

async def test_posting_list():
    """查看posting list表内容"""
    async with AsyncSessionLocal() as session:
        print("=" * 50)
        print("Posting List 测试")
        print("=" * 50)
        print()
        
        # 1. 查看文档统计
        print("【1】文档统计信息:")
        result = await session.execute(text("SELECT * FROM doc_stats"))
        for row in result:
            print(f"  总文档数: {row.total_docs}")
            print(f"  平均文档长度: {row.avg_doc_length:.2f} tokens")
        print()
        
        # 2. 查看词项总数
        print("【2】词项统计:")
        result = await session.execute(text("SELECT COUNT(*) as count FROM terms"))
        count = result.first()[0]
        print(f"  总词项数: {count}")
        print()
        
        # 3. 查看高频词（Top 10）
        print("【3】高频词 Top 10:")
        result = await session.execute(text("""
            SELECT term, doc_frequency, total_frequency
            FROM terms
            ORDER BY total_frequency DESC
            LIMIT 10
        """))
        print(f"  {'词项':<20} {'文档频率(DF)':<15} {'总频率':<10}")
        print("  " + "-" * 50)
        for row in result:
            print(f"  {row.term:<20} {row.doc_frequency:<15} {row.total_frequency:<10}")
        print()
        
        # 4. 查看某个词的posting list
        test_term = "learning"  # 可以改成其他词
        print(f"【4】词'{test_term}'的倒排列表:")
        result = await session.execute(text("""
            SELECT d.id, d.title, p.term_frequency, p.positions[1:5] as positions_sample
            FROM postings p
            JOIN terms t ON p.term_id = t.id
            JOIN documents d ON p.document_id = d.id
            WHERE t.term = :term
            ORDER BY p.term_frequency DESC
            LIMIT 5
        """), {"term": test_term})
        
        found = False
        for row in result:
            found = True
            print(f"  文档ID: {row.id}")
            print(f"  标题: {row.title[:60]}...")
            print(f"  词频(TF): {row.term_frequency}")
            print(f"  位置(前5个): {row.positions_sample}")
            print()
        
        if not found:
            print(f"  未找到包含'{test_term}'的文档")
            print()
        
        # 5. 查看某个文档的词分布
        print("【5】第一个文档的词分布 (Top 10):")
        result = await session.execute(text("SELECT id FROM documents LIMIT 1"))
        row = result.first()
        if row:
            doc_id = row[0]
            result = await session.execute(text("""
                SELECT t.term, p.term_frequency
                FROM postings p
                JOIN terms t ON p.term_id = t.id
                WHERE p.document_id = :doc_id
                ORDER BY p.term_frequency DESC
                LIMIT 10
            """), {"doc_id": doc_id})
            
            print(f"  {'词':<20} {'词频(TF)':<10}")
            print("  " + "-" * 30)
            for row in result:
                print(f"  {row.term:<20} {row.term_frequency:<10}")
        else:
            print("  没有文档")
        print()

if __name__ == "__main__":
    print()
    asyncio.run(test_posting_list())
    print("=" * 50)
    print("测试完成!")
    print("=" * 50)
