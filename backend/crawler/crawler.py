"""
多线程网页爬虫 - 使用 DrissionPage
"""
import asyncio
import logging
import time
import signal
import sys
from typing import List, Optional
from threading import Thread, Event, Lock
from concurrent.futures import ThreadPoolExecutor, as_completed
from DrissionPage import SessionPage, ChromiumPage, ChromiumOptions
from DrissionPage.errors import ElementNotFoundError, PageDisconnectedError

from url_manager import URLManager
from content_extractor import ContentExtractor
from crawler_config import (
    USER_AGENT, REQUEST_TIMEOUT, MAX_RETRIES, REQUEST_DELAY,
    NUM_WORKERS, DEFAULT_SEED_URLS, MAX_DEPTH,
    DRISSION_MODE, HEADLESS, BROWSER_PATH
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 全局 event loop（线程共享）
loop = None
loop_lock = Lock()


def get_event_loop():
    """获取或创建 event loop"""
    global loop
    with loop_lock:
        if loop is None:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop


class CrawlerWorker:
    """爬虫工作线程 - 使用 DrissionPage"""
    
    def __init__(self, worker_id: int, stop_event: Event, browser_instance=None):
        self.worker_id = worker_id
        self.stop_event = stop_event
        self.url_manager = URLManager()
        self.content_extractor = ContentExtractor()
        self.page = None
        self.mode = DRISSION_MODE
        self.browser_instance = browser_instance  # 全局浏览器实例
        
    def _create_page(self):
        """创建 DrissionPage 页面对象"""
        try:
            if self.mode == 's':
                # Session 模式（快速）
                self.page = SessionPage(timeout=REQUEST_TIMEOUT)
                self.page.set.user_agent(USER_AGENT)
                logger.info(f"Worker {self.worker_id}: Using SessionPage (fast mode)")
            else:
                # Driver 模式（浏览器）- 多标签页模式
                if self.browser_instance:
                    # 从全局浏览器创建新标签页
                    self.page = self.browser_instance.new_tab()
                    self.page.set.timeouts(base=REQUEST_TIMEOUT, page_load=REQUEST_TIMEOUT)
                    logger.info(f"Worker {self.worker_id}: Created new tab in global browser")
                else:
                    # 回退到独立控制（不推荐用于并发）
                    co = ChromiumOptions()
                    if HEADLESS:
                        co.headless()
                    if BROWSER_PATH:
                        co.set_browser_path(BROWSER_PATH)
                    co.set_argument('--no-sandbox')
                    co.set_argument('--disable-dev-shm-usage')
                    co.set_user_agent(USER_AGENT)
                    
                    self.page = ChromiumPage(addr_or_opts=co)
                    self.page.set.timeouts(base=REQUEST_TIMEOUT, page_load=REQUEST_TIMEOUT)
                    logger.info(f"Worker {self.worker_id}: Created standalone ChromiumPage")
                    
        except Exception as e:
            logger.error(f"Worker {self.worker_id}: Failed to create page: {e}")
            raise
    
    # ... (fetch_page and index_document remain unchanged) ...
    # 为了避免代码过长被截断，我先保留 run 和 cleanup 部分稍后处理
    
    def fetch_page(self, url: str) -> Optional[str]:
        """获取网页内容"""
        if not self.page:
            self._create_page()
        
        retry_count = 0
        while retry_count < MAX_RETRIES:
            try:
                # 访问页面
                self.page.get(url)
                
                # 等待页面加载和 JS 渲染（如果是浏览器模式）
                if self.mode == 'd':
                    logger.debug(f"Worker {self.worker_id}: Waiting 3s for JS rendering...")
                    time.sleep(3)  # 等待 JS 渲染完成
                
                # 获取 HTML
                html = self.page.html
                
                if not html or len(html) < 100:
                    logger.warning(f"Worker {self.worker_id}: Empty or too short HTML from {url}")
                    return None
                
                return html
            
            except (ElementNotFoundError, PageDisconnectedError) as e:
                logger.warning(f"Worker {self.worker_id}: Page error for {url}: {e}")
                retry_count += 1
                if retry_count < MAX_RETRIES:
                    time.sleep(2 ** retry_count)  # 指数退避
                    # 重新创建页面 (Close old tab, open new one)
                    try:
                        if self.page:
                            self.page.close() if self.mode == 'd' and self.browser_instance else (self.page.quit() if hasattr(self.page, 'quit') else None)
                    except:
                        pass
                    self.page = None
            except Exception as e:
                logger.warning(f"Worker {self.worker_id}: Failed to fetch {url}: {e}")
                retry_count += 1
                if retry_count < MAX_RETRIES:
                    time.sleep(2 ** retry_count)
        
        return None

    # ... index_document ...

    # 需要完整包含 CrawlerWorker 类的方法，因为我要修改 run 中的清理逻辑
    async def index_document(self, title: str, content: str, url: str, images: list = None):
         # ... (same as before)
            import sys
            import os
            
            # 添加 Python 目录到路径
            python_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'python')
            if python_dir not in sys.path:
                sys.path.insert(0, python_dir)
            
            from database import AsyncSessionLocal
            from index_service import get_index_service
            
            # 创建数据库会话
            async with AsyncSessionLocal() as session:
                index_service = get_index_service()
                
                # 索引文档
                doc_id = await index_service.index_document(
                    title=title,
                    content=content,
                    url=url,
                    source_type="web",
                    images=images,  # 传递图片数据
                    metadata={
                        "crawled_at": time.time(),
                        "worker_id": self.worker_id,
                        "crawler_mode": self.mode
                    },
                    session=session
                )
                
                logger.info(f"Worker {self.worker_id}: Indexed document {doc_id} from {url}")
                return doc_id
        
    def process_url(self, task: dict):
        # ... (same as before)
        """处理单个URL"""
        url = task['url']
        depth = task.get('depth', 0)
        
        logger.info(f"Worker {self.worker_id}: Processing {url} (depth={depth})")
        
        if self.url_manager.is_visited(url):
            logger.debug(f"Worker {self.worker_id}: URL already visited (skipping): {url}")
            return
        
        self.url_manager.mark_visited(url)
        self.url_manager.check_and_rest_if_needed()
        
        html = self.fetch_page(url)
        if not html:
            return
        
        extracted = self.content_extractor.extract(html, url)
        if not extracted:
            logger.debug(f"Worker {self.worker_id}: No content extracted from {url}")
            return
        
        images = []
        try:
            from image_extractor import get_image_extractor
            image_extractor = get_image_extractor()
            images = image_extractor.extract_images(html, url)
            if images:
                logger.info(f"Worker {self.worker_id}: Extracted {len(images)} images from {url}")
        except Exception as e:
            logger.warning(f"Worker {self.worker_id}: Failed to extract images from {url}: {e}")
        
        # 索引到数据库（使用共享的 event loop）
        max_retries = 3
        for attempt in range(max_retries):
            try:
                event_loop = get_event_loop()
                future = asyncio.run_coroutine_threadsafe(
                    self.index_document(
                        title=extracted['title'],
                        content=extracted['content'],
                        url=url,
                        images=images
                    ),
                    event_loop
                )
                future.result(timeout=REQUEST_TIMEOUT)
                break # 成功则退出循环
            except Exception as e:
                import traceback
                if attempt < max_retries - 1:
                    # 如果是死锁，通常消息包含 "DeadlockDetectedError"
                    logger.warning(f"Worker {self.worker_id}: Retrying index {url} (attempt {attempt+1}/{max_retries}) due to error: {e}")
                    import random
                    time.sleep(1 + attempt + random.random()) # 随机退避，减少再次死锁概率
                else:
                    logger.error(f"Worker {self.worker_id}: Failed to index {url} after {max_retries} attempts: {e}")
                    logger.error(f"Worker {self.worker_id} Traceback:\n{traceback.format_exc()}")
        
        if MAX_DEPTH == 0 or depth < MAX_DEPTH:
            links = self.url_manager.extract_links(url, html)
            if links:
                added = self.url_manager.add_urls(links, depth + 1)
                logger.debug(f"Worker {self.worker_id}: Added {added} new links from {url}")
        
        time.sleep(REQUEST_DELAY)

    def _report_status(self, status: str, url: str = None):
        # ... (same as before)
        try:
            import json
            import time
            key = f"crawler:worker:{self.worker_id}:status"
            data = {
                "worker_id": self.worker_id,
                "status": status,
                "url": url,
                "timestamp": time.time()
            }
            self.url_manager.redis_client.set(key, json.dumps(data), ex=60)
        except Exception as e:
            logger.error(f"Worker {self.worker_id}: Failed to report status: {e}")

    def run(self):
        """运行爬虫工作线程"""
        logger.info(f"Worker {self.worker_id} started")
        
        try:
            while not self.stop_event.is_set():
                try:
                    task = self.url_manager.get_next_url()
                    
                    if task is None:
                        logger.debug(f"Worker {self.worker_id}: Queue empty, waiting...")
                        time.sleep(5)
                        continue
                    
                    self._report_status("processing", task['url'])
                    self.process_url(task)
                    self._report_status("idle")

                
                except KeyboardInterrupt:
                    logger.info(f"Worker {self.worker_id}: Received interrupt signal")
                    break
                except Exception as e:
                    logger.error(f"Worker {self.worker_id}: Error in main loop: {e}")
                    time.sleep(1)
        finally:
            # 清理资源
            if self.page:
                try:
                    if self.mode == 'd' and self.browser_instance:
                        # 多标签页模式：只关闭当前标签页
                        logger.info(f"Worker {self.worker_id}: Closing tab")
                        self.page.close()
                    elif hasattr(self.page, 'quit'):
                        # 独立模式或 Session 模式：退出
                        self.page.quit()
                except:
                    pass
        
        logger.info(f"Worker {self.worker_id} stopped")


class WebCrawler:
    """多线程网页爬虫管理器"""
    
    def __init__(self, num_workers: int = NUM_WORKERS, seed_urls: Optional[List[str]] = None):
        self.num_workers = num_workers
        self.seed_urls = seed_urls or DEFAULT_SEED_URLS
        self.url_manager = URLManager()
        self.workers: List[Thread] = []
        self.stop_event = Event()
        self.executor = None
        
        # 全局浏览器实例（用于多 Worker 共享，实现多 Tab 并发）
        self.browser_instance = None
        
        # 注册信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """处理终止信号"""
        logger.info(f"Received signal {signum}, stopping crawler...")
        self.stop()
        sys.exit(0)
    
    def initialize_seeds(self):
        # ... (same as before)
        queue_size = self.url_manager.get_queue_size()
        
        if queue_size == 0:
            logger.info(f"Initializing with {len(self.seed_urls)} seed URLs")
            added = self.url_manager.add_urls(self.seed_urls, depth=0)
            logger.info(f"Added {added} seed URLs to queue")
        else:
            logger.info(f"Queue already has {queue_size} URLs, skipping seed initialization")
    
    def start(self):
        """启动爬虫"""
        logger.info(f"Starting web crawler with {self.num_workers} workers (threads)")
        logger.info(f"Mode: {DRISSION_MODE} ({'Session' if DRISSION_MODE == 's' else 'Browser'})")
        
        # 初始化全局浏览器（如果处于浏览器模式）
        if DRISSION_MODE == 'd':
            try:
                co = ChromiumOptions()
                # 强制连接到 9222 端口 (复用用户浏览器)
                co.set_local_port(9222)
                
                if HEADLESS:
                    co.headless()
                if BROWSER_PATH:
                    co.set_browser_path(BROWSER_PATH)
                co.set_argument('--no-sandbox')
                co.set_argument('--disable-dev-shm-usage')
                co.set_user_agent(USER_AGENT)
                
                # 启动全局浏览器
                self.browser_instance = ChromiumPage(addr_or_opts=co)
                logger.info("Initialized global ChromiumPage for multi-tab concurrency")
            except Exception as e:
                logger.error(f"Failed to create global browser: {e}")
                raise
        
        # 启动 event loop 线程
        self._start_event_loop()
        
        # 初始化种子URL
        self.initialize_seeds()
        
        # 启动工作线程
        for i in range(self.num_workers):
            # 传递全局浏览器实例
            worker = Thread(target=self._worker_thread, args=(i,), daemon=True)
            worker.start()
            self.workers.append(worker)
            logger.info(f"Started worker {i}")
        
        # 监控状态
        self._monitor()
    
    def _start_event_loop(self):
        # ... (same)
        def run_loop():
            event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(event_loop)
            global loop
            loop = event_loop
            event_loop.run_forever()
        
        loop_thread = Thread(target=run_loop, daemon=True)
        loop_thread.start()
        time.sleep(0.5)  # 等待 loop 启动
    
    def _worker_thread(self, worker_id: int):
        """工作线程入口"""
        try:
            # 传递 self.browser_instance
            worker = CrawlerWorker(worker_id, self.stop_event, self.browser_instance)
            worker.run()
        except Exception as e:
            logger.error(f"Worker {worker_id} crashed: {e}")
    
    # _monitor same...
    def _monitor(self):
        """监控爬虫状态"""
        try:
            while not self.stop_event.is_set():
                # 检查工作线程状态
                alive_workers = sum(1 for w in self.workers if w.is_alive())
                
                # 获取统计信息
                queue_size = self.url_manager.get_queue_size()
                visited_count = self.url_manager.get_visited_count()
                
                logger.info(
                    f"Status: {alive_workers}/{self.num_workers} workers alive, "
                    f"Queue: {queue_size}, Visited: {visited_count}"
                )
                
                # 如果所有worker都停止了，退出
                if alive_workers == 0:
                    logger.warning("All workers stopped, exiting...")
                    break
                
                time.sleep(30)  # 每30秒输出一次状态
        
        except KeyboardInterrupt:
            logger.info("Monitor received interrupt signal")
            self.stop()

    def stop(self):
        """停止爬虫"""
        logger.info("Stopping all workers...")
        self.stop_event.set()
        
        # 等待所有工作线程结束
        for i, worker in enumerate(self.workers):
            worker.join(timeout=10)
            if worker.is_alive():
                logger.warning(f"Worker {i} did not stop gracefully")
        
        # 停止 event loop
        global loop
        if loop:
            loop.call_soon_threadsafe(loop.stop)
            
        # 关闭全局浏览器
        if self.browser_instance:
            try:
                self.browser_instance.quit()
                logger.info("Closed global browser")
            except:
                pass
        
        # 保存状态
        self.url_manager.save()
        
        logger.info("Crawler stopped")
    
    def get_stats(self) -> dict:
        """获取爬虫统计信息"""
        return {
            'num_workers': self.num_workers,
            'queue_size': self.url_manager.get_queue_size(),
            'visited_count': self.url_manager.get_visited_count(),
            'alive_workers': sum(1 for w in self.workers if w.is_alive()),
        }
