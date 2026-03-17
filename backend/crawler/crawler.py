"""
多线程网页爬虫 - 使用 DrissionPage
"""
import asyncio
import logging
import time
import signal
import sys
import uuid
import socket
import json
import urllib.request
import threading
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
    DRISSION_MODE, HEADLESS, BROWSER_PATH,
    BACKEND_API_URL,
)

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
    global loop
    with loop_lock:
        if loop is None:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop


def _post_json(url: str, data: dict, timeout: int = 5):
    """Simple stdlib JSON POST — no extra dependencies needed."""
    try:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.debug(f"HTTP POST {url} failed: {e}")
        return None


class CrawlerWorker:
    """爬虫工作线程 - 使用 DrissionPage"""

    def __init__(self, worker_id: str, worker_idx: int, stop_event: Event,
                 browser_instance=None):
        self.worker_id   = worker_id    # UUID — used for Redis keys & registration
        self.worker_idx  = worker_idx   # int  — human-readable index for logs
        self.stop_event  = stop_event
        self.url_manager = URLManager()
        self.content_extractor = ContentExtractor()
        self.page = None
        self.mode = DRISSION_MODE
        self.browser_instance = browser_instance

        # Runtime counters (written to Redis every heartbeat)
        self._jobs_completed = 0
        self._jobs_failed    = 0
        self._start_time     = time.time()
        self._current_url    = None

    # ── Page creation ──────────────────────────────────────────────────────────

    def _create_page(self):
        try:
            if self.mode == 's':
                self.page = SessionPage(timeout=REQUEST_TIMEOUT)
                self.page.set.user_agent(USER_AGENT)
                logger.info(f"Worker-{self.worker_idx}: Using SessionPage (fast mode)")
            else:
                if self.browser_instance:
                    self.page = self.browser_instance.new_tab()
                    self.page.set.timeouts(base=REQUEST_TIMEOUT, page_load=REQUEST_TIMEOUT)
                    logger.info(f"Worker-{self.worker_idx}: Created new tab in global browser")
                else:
                    co = ChromiumOptions()
                    if HEADLESS:
                        co.headless()
                    if BROWSER_PATH:
                        co.set_browser_path(BROWSER_PATH)
                    co.set_argument("--no-sandbox")
                    co.set_argument("--disable-dev-shm-usage")
                    co.set_user_agent(USER_AGENT)
                    self.page = ChromiumPage(addr_or_opts=co)
                    self.page.set.timeouts(base=REQUEST_TIMEOUT, page_load=REQUEST_TIMEOUT)
                    logger.info(f"Worker-{self.worker_idx}: Created standalone ChromiumPage")
        except Exception as e:
            logger.error(f"Worker-{self.worker_idx}: Failed to create page: {e}")
            raise

    # ── Heartbeat ──────────────────────────────────────────────────────────────

    def _heartbeat_loop(self):
        """Send heartbeat to Redis DB 1 every 10 s, and POST to backend every 30 s."""
        backend_interval = 30
        last_backend_hb  = 0

        while not self.stop_event.is_set():
            try:
                r = self.url_manager.redis_client
                elapsed = max(time.time() - self._start_time, 1)
                ppm = round(self._jobs_completed / elapsed * 60, 1)

                # --- Redis heartbeat key (TTL 30 s) ---
                r.setex(f"crawler:heartbeat:{self.worker_id}", 30,
                        str(time.time()))

                # --- Redis live-status key (TTL 60 s) ---
                r.setex(f"crawler:worker:{self.worker_id}:status", 60,
                        json.dumps({
                            "worker_id":      self.worker_id,
                            "worker_idx":     self.worker_idx,
                            "url":            self._current_url,
                            "jobs_completed": self._jobs_completed,
                            "jobs_failed":    self._jobs_failed,
                            "pages_per_min":  ppm,
                            "timestamp":      time.time(),
                        }))

                # --- HTTP heartbeat to backend (less frequent) ---
                now = time.time()
                if now - last_backend_hb >= backend_interval:
                    _post_json(
                        f"{BACKEND_API_URL}/api/v1/admin/crawler/workers/{self.worker_id}/heartbeat",
                        {
                            "jobs_completed": self._jobs_completed,
                            "jobs_failed":    self._jobs_failed,
                            "pages_per_min":  ppm,
                            "current_url":    self._current_url,
                        },
                    )
                    last_backend_hb = now

            except Exception as e:
                logger.debug(f"Worker-{self.worker_idx}: Heartbeat error: {e}")

            time.sleep(10)

    # ── Fetch ──────────────────────────────────────────────────────────────────

    def fetch_page(self, url: str) -> Optional[str]:
        if not self.page:
            self._create_page()

        retry_count = 0
        while retry_count < MAX_RETRIES:
            try:
                self.page.get(url)
                if self.mode == 'd':
                    time.sleep(3)
                html = self.page.html
                if not html or len(html) < 100:
                    return None
                return html

            except (ElementNotFoundError, PageDisconnectedError) as e:
                logger.warning(f"Worker-{self.worker_idx}: Page error for {url}: {e}")
                retry_count += 1
                if retry_count < MAX_RETRIES:
                    time.sleep(2 ** retry_count)
                    try:
                        if self.page:
                            if self.mode == 'd' and self.browser_instance:
                                self.page.close()
                            elif hasattr(self.page, 'quit'):
                                self.page.quit()
                    except Exception:
                        pass
                    self.page = None
            except Exception as e:
                logger.warning(f"Worker-{self.worker_idx}: Failed to fetch {url}: {e}")
                retry_count += 1
                if retry_count < MAX_RETRIES:
                    time.sleep(2 ** retry_count)

        return None

    # ── Index ──────────────────────────────────────────────────────────────────

    async def index_document(self, title: str, content: str, url: str,
                             images: list = None):
        import sys
        import os

        python_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'python'
        )
        if python_dir not in sys.path:
            sys.path.insert(0, python_dir)

        from database import AsyncSessionLocal
        from index_service import get_index_service

        async with AsyncSessionLocal() as session:
            index_service = get_index_service()
            doc_id = await index_service.index_document(
                title=title,
                content=content,
                url=url,
                source_type="web",
                images=images,
                metadata={
                    "crawled_at": time.time(),
                    "worker_id":  self.worker_id,
                    "worker_idx": self.worker_idx,
                    "crawler_mode": self.mode,
                },
                session=session,
            )
            logger.info(f"Worker-{self.worker_idx}: Indexed doc {doc_id} from {url}")
            return doc_id

    # ── Process URL ────────────────────────────────────────────────────────────

    def process_url(self, task: dict):
        url   = task['url']
        depth = task.get('depth', 0)

        logger.info(f"Worker-{self.worker_idx}: Processing {url} (depth={depth})")

        if self.url_manager.is_visited(url):
            logger.debug(f"Worker-{self.worker_idx}: Already visited, skipping: {url}")
            return

        self.url_manager.mark_visited(url)
        self.url_manager.check_and_rest_if_needed()

        html = self.fetch_page(url)
        if not html:
            return

        extracted = self.content_extractor.extract(html, url)
        if not extracted:
            return

        images = []
        try:
            from image_extractor import get_image_extractor
            images = get_image_extractor().extract_images(html, url)
            if images:
                logger.info(f"Worker-{self.worker_idx}: Extracted {len(images)} images from {url}")
        except Exception as e:
            logger.warning(f"Worker-{self.worker_idx}: Image extraction failed: {e}")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self.index_document(
                        title=extracted['title'],
                        content=extracted['content'],
                        url=url,
                        images=images,
                    ),
                    get_event_loop(),
                )
                future.result(timeout=REQUEST_TIMEOUT)
                break
            except Exception as e:
                import traceback
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Worker-{self.worker_idx}: Retrying index {url} "
                        f"(attempt {attempt+1}/{max_retries}): {e}"
                    )
                    time.sleep(1 + attempt)
                else:
                    logger.error(
                        f"Worker-{self.worker_idx}: Failed to index {url} "
                        f"after {max_retries} attempts: {e}\n{traceback.format_exc()}"
                    )

        if MAX_DEPTH == 0 or depth < MAX_DEPTH:
            links = self.url_manager.extract_links(url, html)
            if links:
                added = self.url_manager.add_urls(links, depth + 1)
                logger.debug(f"Worker-{self.worker_idx}: Added {added} new links from {url}")

        time.sleep(REQUEST_DELAY)

    # ── Status helper ──────────────────────────────────────────────────────────

    def _report_status(self, status: str, url: str = None):
        self._current_url = url if status == "processing" else None
        try:
            key  = f"crawler:worker:{self.worker_id}:status"
            elapsed = max(time.time() - self._start_time, 1)
            ppm  = round(self._jobs_completed / elapsed * 60, 1)
            data = {
                "worker_id":      self.worker_id,
                "worker_idx":     self.worker_idx,
                "status":         status,
                "url":            url,
                "jobs_completed": self._jobs_completed,
                "jobs_failed":    self._jobs_failed,
                "pages_per_min":  ppm,
                "timestamp":      time.time(),
            }
            self.url_manager.redis_client.setex(key, 60, json.dumps(data))
        except Exception as e:
            logger.debug(f"Worker-{self.worker_idx}: _report_status error: {e}")

    # ── Main run loop ──────────────────────────────────────────────────────────

    def run(self):
        logger.info(f"Worker-{self.worker_idx} started (id={self.worker_id[:8]}…)")

        # Start background heartbeat thread
        hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        hb_thread.start()

        try:
            while not self.stop_event.is_set():
                try:
                    task = self.url_manager.get_next_url()
                    if task is None:
                        logger.debug(f"Worker-{self.worker_idx}: Queue empty, waiting…")
                        time.sleep(5)
                        continue

                    self._report_status("processing", task['url'])
                    try:
                        self.process_url(task)
                        self._jobs_completed += 1
                    except Exception as e:
                        self._jobs_failed += 1
                        logger.error(f"Worker-{self.worker_idx}: process_url error: {e}")
                    self._report_status("idle")

                except KeyboardInterrupt:
                    break
                except Exception as e:
                    logger.error(f"Worker-{self.worker_idx}: Main loop error: {e}")
                    time.sleep(1)
        finally:
            if self.page:
                try:
                    if self.mode == 'd' and self.browser_instance:
                        self.page.close()
                    elif hasattr(self.page, 'quit'):
                        self.page.quit()
                except Exception:
                    pass

        logger.info(f"Worker-{self.worker_idx} stopped")


# ──────────────────────────────────────────────────────────────────────────────

class WebCrawler:
    """多线程网页爬虫管理器"""

    def __init__(self, num_workers: int = NUM_WORKERS,
                 seed_urls: Optional[List[str]] = None):
        self.num_workers      = num_workers
        self.seed_urls        = seed_urls or DEFAULT_SEED_URLS
        self.url_manager      = URLManager()
        self.workers: List[Thread] = []
        self.stop_event       = Event()
        self.browser_instance = None

        # Assign a UUID to each worker thread
        self.worker_uuids = [str(uuid.uuid4()) for _ in range(num_workers)]

        signal.signal(signal.SIGINT,  self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        logger.info(f"Received signal {signum}, stopping crawler…")
        self.stop()
        sys.exit(0)

    def _get_host_info(self):
        hostname = socket.gethostname()
        try:
            ip = socket.gethostbyname(hostname)
        except Exception:
            ip = "127.0.0.1"
        return hostname, ip

    def _register_workers(self):
        """Register all worker threads with the Python backend."""
        hostname, ip = self._get_host_info()
        caps = ["js_render"] if DRISSION_MODE == 'd' else ["fast"]

        for idx, worker_uuid in enumerate(self.worker_uuids):
            result = _post_json(
                f"{BACKEND_API_URL}/api/v1/admin/crawler/workers/register",
                {
                    "worker_id":   worker_uuid,
                    "hostname":    f"{hostname}-worker-{idx}",
                    "ip_address":  ip,
                    "version":     "1.0.0",
                    "capabilities": caps,
                },
            )
            if result and result.get("registered"):
                logger.info(f"Worker-{idx} registered (id={worker_uuid[:8]}…)")
            else:
                logger.warning(
                    f"Worker-{idx} could not register with backend at {BACKEND_API_URL} "
                    f"(running in offline mode)"
                )

    def initialize_seeds(self):
        queue_size = self.url_manager.get_queue_size()
        if queue_size == 0:
            logger.info(f"Initializing with {len(self.seed_urls)} seed URLs")
            added = self.url_manager.add_urls(self.seed_urls, depth=0)
            logger.info(f"Added {added} seed URLs to queue")
        else:
            logger.info(f"Queue has {queue_size} URLs, resuming from last state")

    def start(self):
        logger.info(f"Starting web crawler with {self.num_workers} workers")
        logger.info(f"Mode: {DRISSION_MODE} ({'Session' if DRISSION_MODE == 's' else 'Browser'})")

        # Initialize global browser for browser mode
        if DRISSION_MODE == 'd':
            try:
                co = ChromiumOptions()
                co.set_local_port(9222)
                if HEADLESS:
                    co.headless()
                if BROWSER_PATH:
                    co.set_browser_path(BROWSER_PATH)
                co.set_argument("--no-sandbox")
                co.set_argument("--disable-dev-shm-usage")
                co.set_user_agent(USER_AGENT)
                self.browser_instance = ChromiumPage(addr_or_opts=co)
                logger.info("Initialized global ChromiumPage for multi-tab concurrency")
            except Exception as e:
                logger.error(f"Failed to create global browser: {e}")
                raise

        # Register workers with backend
        self._register_workers()

        # Start event loop thread
        self._start_event_loop()

        # Initialize seed URLs
        self.initialize_seeds()

        # Start worker threads
        for i in range(self.num_workers):
            worker = Thread(
                target=self._worker_thread,
                args=(i, self.worker_uuids[i]),
                daemon=True,
            )
            worker.start()
            self.workers.append(worker)
            logger.info(f"Started worker-{i} (id={self.worker_uuids[i][:8]}…)")

        self._monitor()

    def _start_event_loop(self):
        def run_loop():
            event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(event_loop)
            global loop
            loop = event_loop
            event_loop.run_forever()

        loop_thread = Thread(target=run_loop, daemon=True)
        loop_thread.start()
        time.sleep(0.5)

    def _worker_thread(self, worker_idx: int, worker_uuid: str):
        try:
            worker = CrawlerWorker(
                worker_uuid, worker_idx, self.stop_event, self.browser_instance
            )
            worker.run()
        except Exception as e:
            logger.error(f"Worker-{worker_idx} crashed: {e}")

    def _monitor(self):
        try:
            while not self.stop_event.is_set():
                alive = sum(1 for w in self.workers if w.is_alive())
                queue_size   = self.url_manager.get_queue_size()
                visited_count = self.url_manager.get_visited_count()
                logger.info(
                    f"Status: {alive}/{self.num_workers} workers alive, "
                    f"Queue: {queue_size}, Visited: {visited_count}"
                )
                if alive == 0:
                    logger.warning("All workers stopped, exiting…")
                    break
                time.sleep(30)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        logger.info("Stopping all workers…")
        self.stop_event.set()

        for i, worker in enumerate(self.workers):
            worker.join(timeout=10)
            if worker.is_alive():
                logger.warning(f"Worker-{i} did not stop gracefully")

        global loop
        if loop:
            loop.call_soon_threadsafe(loop.stop)

        if self.browser_instance:
            try:
                self.browser_instance.quit()
                logger.info("Closed global browser")
            except Exception:
                pass

        self.url_manager.save()
        logger.info("Crawler stopped")

    def get_stats(self) -> dict:
        return {
            "num_workers":   self.num_workers,
            "worker_uuids":  self.worker_uuids,
            "queue_size":    self.url_manager.get_queue_size(),
            "visited_count": self.url_manager.get_visited_count(),
            "alive_workers": sum(1 for w in self.workers if w.is_alive()),
        }
