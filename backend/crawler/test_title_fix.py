#!/usr/bin/env python3
"""
测试修改后的标题提取
"""
import sys
sys.path.insert(0, '/home/lancelot/verdant_search/backend/crawler')

from DrissionPage import ChromiumPage, ChromiumOptions
from content_extractor import ContentExtractor
import time

def test_extraction(url: str):
    """测试标题提取"""
    print(f"\n{'='*60}")
    print(f"测试 URL: {url}")
    print(f"{'='*60}\n")
    
    # 1. 获取页面
    print("1️⃣ 获取页面...")
    co = ChromiumOptions()
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-dev-shm-usage')
    
    page = ChromiumPage(addr_or_opts=co)
    page.get(url)
    time.sleep(3)
    
    html_content = page.html
    browser_title = page.title
    
    print(f"   浏览器标题: {browser_title}")
    
    # 2. 使用内容提取器
    print(f"\n2️⃣ 使用 ContentExtractor 提取...")
    extractor = ContentExtractor()
    result = extractor.extract(html_content, url)
    
    if result:
        print(f"   提取的标题: {result['title']}")
        print(f"   内容长度: {len(result['content'])} 字符")
        print(f"   内容预览: {result['content'][:200]}...")
        
        # 3. 对比
        print(f"\n3️⃣ 对比结果:")
        if result['title'] == browser_title:
            print(f"   ✅ 标题匹配！")
        else:
            print(f"   ❌ 标题不匹配")
            print(f"      浏览器: {browser_title}")
            print(f"      提取的: {result['title']}")
    else:
        print(f"   ❌ 提取失败")
    
    page.quit()
    print(f"\n{'='*60}\n")

if __name__ == "__main__":
    # 测试几个URL
    test_urls = [
        "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/module-summary.html",
        "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/String.html",
    ]
    
    if len(sys.argv) > 1:
        test_urls = [sys.argv[1]]
    
    for url in test_urls:
        test_extraction(url)
