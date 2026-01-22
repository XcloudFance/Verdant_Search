#!/usr/bin/env python3
"""
简单示例：爬取单个网页
"""
import asyncio
import sys
import os

# 添加当前目录和 Python 目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
python_dir = os.path.join(os.path.dirname(current_dir), 'python')
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if python_dir not in sys.path:
    sys.path.insert(0, python_dir)

from url_manager import URLManager
from content_extractor import ContentExtractor
from database import AsyncSessionLocal
from index_service import get_index_service
import requests


async def crawl_single_page(url: str):
    """爬取单个页面并索引"""
    print(f"开始爬取: {url}")
    
    # 1. 获取网页内容
    print("正在获取网页...")
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        html = response.text
        print(f"✓ 获取成功，内容长度: {len(html)} 字符")
    except Exception as e:
        print(f"✗ 获取失败: {e}")
        return
    
    # 2. 提取内容
    print("正在提取内容...")
    extractor = ContentExtractor()
    extracted = extractor.extract(html, url)
    
    if not extracted:
        print("✗ 内容提取失败")
        return
    
    print(f"✓ 提取成功")
    print(f"  标题: {extracted['title']}")
    print(f"  内容长度: {len(extracted['content'])} 字符")
    
    # 3. 索引到数据库
    print("正在索引到数据库...")
    try:
        async with AsyncSessionLocal() as session:
            index_service = get_index_service()
            
            doc_id = await index_service.index_document(
                title=extracted['title'],
                content=extracted['content'],
                url=url,
                source_type="web",
                metadata={"crawled_at": "manual"},
                session=session
            )
            
            print(f"✓ 索引成功，文档ID: {doc_id}")
    except Exception as e:
        print(f"✗ 索引失败: {e}")
        return
    
    # 4. 提取链接
    print("正在提取链接...")
    url_manager = URLManager()
    links = url_manager.extract_links(url, html)
    print(f"✓ 找到 {len(links)} 个链接:")
    for i, link in enumerate(links[:10], 1):
        print(f"  {i}. {link}")
    if len(links) > 10:
        print(f"  ... 还有 {len(links) - 10} 个链接")
    
    print("\n完成!")


def main():
    if len(sys.argv) < 2:
        print("用法: python example_single_page.py <URL>")
        print("\n示例:")
        print("  python example_single_page.py https://www.python.org/")
        sys.exit(1)
    
    url = sys.argv[1]
    asyncio.run(crawl_single_page(url))


if __name__ == '__main__':
    main()
