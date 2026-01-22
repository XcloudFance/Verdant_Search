#!/usr/bin/env python3
"""
爬虫主程序入口
"""
import argparse
import logging
from typing import List

from crawler import WebCrawler
from url_manager import URLManager
from crawler_config import DEFAULT_SEED_URLS, NUM_WORKERS

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='分布式网页爬虫')
    
    parser.add_argument(
        '--seeds',
        type=str,
        nargs='+',
        help='种子URL列表（多个URL用空格分隔）'
    )
    
    parser.add_argument(
        '--workers',
        type=int,
        default=NUM_WORKERS,
        help=f'并发工作进程数（默认: {NUM_WORKERS}）'
    )
    
    parser.add_argument(
        '--clear',
        action='store_true',
        help='清空所有爬虫数据（URL队列和Bloomfilter）'
    )
    
    parser.add_argument(
        '--stats',
        action='store_true',
        help='显示当前爬虫统计信息'
    )
    
    args = parser.parse_args()
    
    # 处理清空数据命令
    if args.clear:
        logger.info("Clearing all crawler data...")
        url_manager = URLManager()
        url_manager.clear_all()
        logger.info("All crawler data cleared")
        return
    
    # 处理统计信息命令
    if args.stats:
        url_manager = URLManager()
        queue_size = url_manager.get_queue_size()
        visited_count = url_manager.get_visited_count()
        
        logger.info("=== Crawler Statistics ===")
        logger.info(f"Queue size: {queue_size}")
        logger.info(f"Visited URLs: {visited_count}")
        return
    
    # 获取种子URL
    seed_urls: List[str] = args.seeds if args.seeds else DEFAULT_SEED_URLS
    
    logger.info("=== Starting Web Crawler ===")
    logger.info(f"Workers: {args.workers}")
    logger.info(f"Seed URLs: {seed_urls}")
    
    # 创建并启动爬虫
    crawler = WebCrawler(
        num_workers=args.workers,
        seed_urls=seed_urls
    )
    
    try:
        crawler.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        crawler.stop()


if __name__ == '__main__':
    main()
