#!/usr/bin/env python3
"""
爬虫组件测试脚本
"""
import sys
import os
# 添加当前目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from url_manager import URLManager
from content_extractor import ContentExtractor
import requests


def test_redis_connection():
    """测试Redis连接"""
    print("测试 Redis 连接...")
    try:
        manager = URLManager()
        print(f"✓ Redis 连接成功")
        print(f"  - 队列大小: {manager.get_queue_size()}")
        print(f"  - 已访问URL数: {manager.get_visited_count()}")
        return True
    except Exception as e:
        print(f"✗ Redis 连接失败: {e}")
        return False


def test_bloomfilter():
    """测试Bloomfilter"""
    print("\n测试 Bloomfilter...")
    try:
        manager = URLManager()
        
        # 测试URL
        test_url = "https://test.example.com/page1"
        
        # 检查初始状态
        is_visited = manager.is_visited(test_url)
        print(f"  - URL初始状态: {'已访问' if is_visited else '未访问'}")
        
        # 标记为已访问
        manager.mark_visited(test_url)
        
        # 再次检查
        is_visited = manager.is_visited(test_url)
        print(f"  - 标记后状态: {'已访问' if is_visited else '未访问'}")
        
        if is_visited:
            print(f"✓ Bloomfilter 工作正常")
            return True
        else:
            print(f"✗ Bloomfilter 未正常工作")
            return False
    except Exception as e:
        print(f"✗ Bloomfilter 测试失败: {e}")
        return False


def test_url_validation():
    """测试URL验证"""
    print("\n测试 URL 验证...")
    manager = URLManager()
    
    test_cases = [
        ("https://www.example.com/", True),
        ("http://example.com/page", True),
        ("ftp://example.com/", False),
        ("https://example.com/image.jpg", False),
        ("https://example.com/doc.pdf", False),
        ("not-a-url", False),
    ]
    
    all_passed = True
    for url, expected in test_cases:
        result = manager.is_valid_url(url)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {url}: {result} (期望: {expected})")
        if result != expected:
            all_passed = False
    
    if all_passed:
        print(f"✓ URL验证测试通过")
    else:
        print(f"✗ URL验证测试失败")
    
    return all_passed


def test_content_extraction():
    """测试内容提取"""
    print("\n测试内容提取...")
    
    html = """
    <html>
    <head>
        <title>Test Page</title>
        <meta property="og:title" content="OG Test Title">
    </head>
    <body>
        <h1>Main Title</h1>
        <article>
            <p>This is the main content of the page.</p>
            <p>It has multiple paragraphs.</p>
        </article>
        <script>console.log('test');</script>
    </body>
    </html>
    """
    
    try:
        extractor = ContentExtractor()
        result = extractor.extract(html, "https://test.example.com")
        
        if result:
            print(f"✓ 内容提取成功")
            print(f"  - 标题: {result['title']}")
            print(f"  - 内容长度: {len(result['content'])} 字符")
            print(f"  - 内容预览: {result['content'][:100]}...")
            return True
        else:
            print(f"✗ 内容提取失败")
            return False
    except Exception as e:
        print(f"✗ 内容提取测试失败: {e}")
        return False


def test_link_extraction():
    """测试链接提取"""
    print("\n测试链接提取...")
    
    html = """
    <html>
    <body>
        <a href="https://example.com/page1">Link 1</a>
        <a href="/relative/page">Relative Link</a>
        <a href="image.jpg">Image</a>
        <a href="https://other.com/page">External Link</a>
    </body>
    </html>
    """
    
    try:
        manager = URLManager()
        links = manager.extract_links("https://example.com/base", html)
        
        print(f"✓ 提取到 {len(links)} 个链接:")
        for link in links:
            print(f"  - {link}")
        
        return True
    except Exception as e:
        print(f"✗ 链接提取测试失败: {e}")
        return False


def test_task_queue():
    """测试任务队列"""
    print("\n测试任务队列...")
    
    try:
        manager = URLManager()
        
        # 添加测试URL
        test_urls = [
            "https://test1.example.com/",
            "https://test2.example.com/",
            "https://test3.example.com/",
        ]
        
        print(f"添加 {len(test_urls)} 个测试URL...")
        added = manager.add_urls(test_urls, depth=0)
        print(f"成功添加 {added} 个URL")
        
        # 获取URL
        print(f"从队列获取URL...")
        for i in range(min(added, 3)):
            task = manager.get_next_url()
            if task:
                print(f"  - {task['url']} (depth={task['depth']})")
        
        print(f"✓ 任务队列测试通过")
        return True
    except Exception as e:
        print(f"✗ 任务队列测试失败: {e}")
        return False


def test_http_request():
    """测试HTTP请求"""
    print("\n测试 HTTP 请求...")
    
    try:
        from crawler import CrawlerWorker
        from multiprocessing import Event
        
        worker = CrawlerWorker(0, Event())
        html = worker.fetch_page("https://www.example.com/")
        
        if html:
            print(f"✓ HTTP请求成功")
            print(f"  - 响应长度: {len(html)} 字符")
            return True
        else:
            print(f"✗ HTTP请求失败")
            return False
    except Exception as e:
        print(f"✗ HTTP请求测试失败: {e}")
        return False


def main():
    print("=" * 60)
    print("爬虫组件测试")
    print("=" * 60)
    
    tests = [
        ("Redis连接", test_redis_connection),
        ("Bloomfilter", test_bloomfilter),
        ("URL验证", test_url_validation),
        ("内容提取", test_content_extraction),
        ("链接提取", test_link_extraction),
        ("任务队列", test_task_queue),
        ("HTTP请求", test_http_request),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n测试 '{name}' 出现异常: {e}")
            results.append((name, False))
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status}: {name}")
    
    print("-" * 60)
    print(f"总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！爬虫可以正常使用。")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败，请检查配置。")
        return 1


if __name__ == '__main__':
    exit(main())
