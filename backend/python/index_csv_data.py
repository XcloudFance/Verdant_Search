"""
从CSV文件索引数据到搜索引擎
读取vpn_gfw_dataset_high_quality.csv的前100条数据并建立索引
"""
import asyncio
import csv
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from database import AsyncSessionLocal, init_db
from index_service import get_index_service

async def index_csv_data(csv_file: str, limit: int = 100):
    """
    从CSV文件索引数据
    
    Args:
        csv_file: CSV文件路径
        limit: 索引的最大行数
    """
    # 初始化数据库
    await init_db()
    print("数据库初始化完成")
    
    # 读取CSV文件
    print(f"\n读取CSV文件: {csv_file}")
    documents = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        # 尝试检测分隔符
        first_line = f.readline()
        f.seek(0)
        
        # CSV读取
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader):
            if i >= limit:
                break
            
            # 根据CSV的列构建文档
            # 假设CSV有title和content列，如果没有则从其他列推断
            
            # 打印第一行看看列名
            if i == 0:
                print(f"\nCSV列名: {list(row.keys())}")
            
            # 尝试从不同的列名获取数据
            title = (row.get('title') or row.get('标题') or 
                    row.get('question') or row.get('问题') or 
                    row.get('query') or row.get('查询') or 
                    f"Document {i+1}")
            
            content = (row.get('content') or row.get('内容') or 
                      row.get('answer') or row.get('回答') or 
                      row.get('text') or row.get('文本') or 
                      row.get('description') or row.get('描述') or 
                      ' '.join([v for k, v in row.items() if v]))
            
            # 如果title就是content的一部分，尝试提取更好的title
            if len(title) > 100:
                # 从content中提取前50个字符作为title
                title = content[:50] + "..."
            
            url = row.get('url') or row.get('link') or row.get('链接') or None
            
            documents.append({
                "title": title,
                "content": content,
                "url": url,
                "source_type": "csv",
                "metadata": {"csv_row": i+1, "source_file": csv_file}
            })
            
            if (i + 1) % 10 == 0:
                print(f"已读取 {i+1} 条数据...")
    
    print(f"\n总共读取 {len(documents)} 条数据")
    
    # 索引到数据库
    print("\n开始索引到数据库...")
    indexed_count = 0
    failed_count = 0
    
    async with AsyncSessionLocal() as session:
        index_service = get_index_service()
        
        for i, doc in enumerate(documents):
            try:
                doc_id = await index_service.index_document(
                    title=doc["title"],
                    content=doc["content"],
                    url=doc["url"],
                    source_type=doc["source_type"],
                    metadata=doc["metadata"],
                    session=session
                )
                indexed_count += 1
                
                if (i + 1) % 10 == 0:
                    print(f"✓ 已索引 {i+1}/{len(documents)} 条")
                    
            except Exception as e:
                print(f"✗ 索引失败 (行{i+1}): {str(e)[:100]}")
                failed_count += 1
    
    print("\n" + "=" * 60)
    print("索引完成!")
    print("=" * 60)
    print(f"✓ 成功: {indexed_count}")
    print(f"✗ 失败: {failed_count}")
    print(f"总计: {len(documents)}")
    print("=" * 60)
    print("\n现在可以启动服务并搜索了！")
    print("运行: bash start.sh")

if __name__ == "__main__":
    csv_file = "../../vpn_gfw_dataset_high_quality.csv"
    
    print("=" * 60)
    print("CSV数据索引工具")
    print("=" * 60)
    
    asyncio.run(index_csv_data(csv_file, limit=100))
