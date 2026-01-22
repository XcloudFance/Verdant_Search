#!/usr/bin/env python3
"""
调试标题提取 - 查看爬虫如何提取网页标题
"""
import sys
from DrissionPage import ChromiumPage, ChromiumOptions
import trafilatura
from lxml import html as lxml_html

def debug_title_extraction(url: str):
    """调试指定URL的标题提取"""
    print(f"\n{'='*60}")
    print(f"调试 URL: {url}")
    print(f"{'='*60}\n")
    
    # 1. 使用浏览器获取页面
    print("1️⃣ 使用 DrissionPage 获取页面...")
    co = ChromiumOptions()
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-dev-shm-usage')
    
    page = ChromiumPage(addr_or_opts=co)
    page.get(url)
    
    # 等待页面加载
    import time
    time.sleep(3)
    
    # 获取HTML
    html_content = page.html
    
    # 2. 浏览器中看到的标题
    print(f"\n2️⃣ 浏览器标题 (page.title): {page.title}")
    
    # 3. <title> 标签
    try:
        tree = lxml_html.fromstring(html_content)
        title_tag = tree.xpath('//title/text()')
        print(f"\n3️⃣ <title> 标签内容: {title_tag[0] if title_tag else 'None'}")
    except Exception as e:
        print(f"\n3️⃣ <title> 标签提取失败: {e}")
    
    # 4. og:title
    try:
        og_title = tree.xpath('//meta[@property="og:title"]/@content')
        print(f"\n4️⃣ og:title 元标签: {og_title[0] if og_title else 'None'}")
    except Exception as e:
        print(f"\n4️⃣ og:title 提取失败: {e}")
    
    # 5. h1 标签
    try:
        h1_tags = tree.xpath('//h1/text()')
        print(f"\n5️⃣ <h1> 标签内容: {h1_tags[:3] if h1_tags else 'None'}")  # 显示前3个
    except Exception as e:
        print(f"\n5️⃣ <h1> 提取失败: {e}")
    
    # 6. trafilatura 提取的元数据
    print(f"\n6️⃣ Trafilatura 元数据:")
    try:
        metadata = trafilatura.extract_metadata(html_content)
        if metadata:
            print(f"   - metadata.title: {metadata.title}")
            print(f"   - metadata.sitename: {metadata.sitename}")
            print(f"   - metadata.author: {metadata.author}")
            print(f"   - metadata.description: {metadata.description[:100] if metadata.description else 'None'}")
        else:
            print("   - 无法提取元数据")
    except Exception as e:
        print(f"   - 提取失败: {e}")
    
    # 7. 当前爬虫会使用的标题
    print(f"\n7️⃣ 当前爬虫逻辑会提取的标题:")
    title = None
    if metadata:
        title = metadata.title or metadata.sitename
    
    if not title:
        # 备用方案
        og_title = tree.xpath('//meta[@property="og:title"]/@content')
        if og_title:
            title = og_title[0]
        else:
            title_tag = tree.xpath('//title/text()')
            if title_tag:
                title = title_tag[0]
            else:
                h1 = tree.xpath('//h1/text()')
                if h1:
                    title = h1[0]
    
    print(f"   ➡️  最终标题: {title}")
    
    # 8. 显示HTML的前1000个字符
    print(f"\n8️⃣ HTML 前1000字符:")
    print(html_content[:1000])
    
    page.quit()
    print(f"\n{'='*60}\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python debug_title_extraction.py <URL>")
        print("\n示例:")
        print("  python debug_title_extraction.py https://docs.oracle.com/en/java/javase/17/docs/api/java.base/module-summary.html")
        sys.exit(1)
    
    url = sys.argv[1]
    debug_title_extraction(url)
