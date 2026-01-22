"""
URL管理器 - 使用Redis Bloomfilter去重和任务队列
"""
import redis
from typing import List, Optional
from urllib.parse import urlparse, urljoin
import logging
from pybloom_live import BloomFilter
import pickle

from crawler_config import (
    REDIS_HOST, REDIS_PORT, REDIS_CRAWLER_DB, REDIS_PASSWORD,
    BLOOMFILTER_KEY, TASK_QUEUE_KEY,
    BLOOMFILTER_ERROR_RATE, BLOOMFILTER_CAPACITY,
    EXCLUDED_EXTENSIONS, ALLOWED_DOMAINS,
    ENABLE_RATE_LIMIT, REQUESTS_PER_BATCH, BATCH_REST_DURATION
)

logger = logging.getLogger(__name__)


class URLManager:
    """URL管理器 - 使用Redis Bloomfilter去重"""
    
    def __init__(self):
        # 连接Redis
        self.redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_CRAWLER_DB,
            password=REDIS_PASSWORD if REDIS_PASSWORD else None,
            decode_responses=False  # Bloomfilter需要bytes
        )
        
        # 初始化或加载Bloomfilter
        self.bloom_filter = self._load_or_create_bloom_filter()
        
        logger.info(f"URLManager initialized with Redis at {REDIS_HOST}:{REDIS_PORT}/{REDIS_CRAWLER_DB}")
    
    def _load_or_create_bloom_filter(self) -> BloomFilter:
        """从Redis加载或创建新的Bloomfilter"""
        try:
            bloom_data = self.redis_client.get(BLOOMFILTER_KEY)
            if bloom_data:
                bloom_filter = pickle.loads(bloom_data)
                logger.info(f"Loaded existing Bloomfilter with {bloom_filter.count} items")
                return bloom_filter
        except Exception as e:
            logger.warning(f"Failed to load Bloomfilter: {e}")
        
        # 创建新的Bloomfilter
        bloom_filter = BloomFilter(capacity=BLOOMFILTER_CAPACITY, error_rate=BLOOMFILTER_ERROR_RATE)
        logger.info(f"Created new Bloomfilter (capacity={BLOOMFILTER_CAPACITY}, error_rate={BLOOMFILTER_ERROR_RATE})")
        return bloom_filter
    
    def _save_bloom_filter(self):
        """保存Bloomfilter到Redis"""
        try:
            bloom_data = pickle.dumps(self.bloom_filter)
            self.redis_client.set(BLOOMFILTER_KEY, bloom_data)
        except Exception as e:
            logger.error(f"Failed to save Bloomfilter: {e}")
    
    def normalize_url(self, url: str) -> str:
        """标准化URL"""
        # 移除URL fragment
        parsed = urlparse(url)
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized.rstrip('/')
    
    def is_valid_url(self, url: str) -> bool:
        """检查URL是否有效"""
        try:
            parsed = urlparse(url)
            
            # 检查协议
            if parsed.scheme not in ['http', 'https']:
                return False
            
            # 检查是否有域名
            if not parsed.netloc:
                return False
            
            # 检查扩展名
            path = parsed.path.lower()
            if any(path.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
                return False
            
            # 检查域名白名单
            if ALLOWED_DOMAINS:
                domain = parsed.netloc.lower()
                if not any(allowed in domain for allowed in ALLOWED_DOMAINS):
                    return False
            
            return True
        except Exception:
            return False
    
    def is_visited(self, url: str) -> bool:
        """检查URL是否已访问（实时从Redis加载）"""
        normalized_url = self.normalize_url(url)
        
        # 实时从 Redis 加载最新的 Bloomfilter
        try:
            bloom_data = self.redis_client.get(BLOOMFILTER_KEY)
            if bloom_data:
                bloom_filter = pickle.loads(bloom_data)
                return normalized_url in bloom_filter
        except Exception as e:
            logger.warning(f"Failed to load Bloomfilter for check: {e}")
        
        # 如果加载失败，使用本地缓存
        return normalized_url in self.bloom_filter
    
    def mark_visited(self, url: str):
        """标记URL为已访问（实时保存到Redis）"""
        normalized_url = self.normalize_url(url)
        
        # 使用 Redis 锁确保原子性
        lock_key = f"{BLOOMFILTER_KEY}:lock"
        lock = self.redis_client.lock(lock_key, timeout=5)
        
        try:
            # 获取锁
            if lock.acquire(blocking=True, blocking_timeout=10):
                try:
                    # 从 Redis 加载最新的 Bloomfilter
                    bloom_data = self.redis_client.get(BLOOMFILTER_KEY)
                    if bloom_data:
                        bloom_filter = pickle.loads(bloom_data)
                    else:
                        bloom_filter = BloomFilter(capacity=BLOOMFILTER_CAPACITY, error_rate=BLOOMFILTER_ERROR_RATE)
                    
                    # 添加 URL
                    bloom_filter.add(normalized_url)
                    
                    # 保存回 Redis
                    bloom_data = pickle.dumps(bloom_filter)
                    self.redis_client.set(BLOOMFILTER_KEY, bloom_data)
                    
                    # 更新本地缓存
                    self.bloom_filter = bloom_filter
                    
                finally:
                    # 释放锁
                    lock.release()
            else:
                logger.warning(f"Failed to acquire lock for marking URL as visited: {url}")
        except Exception as e:
            logger.error(f"Failed to mark URL as visited: {e}")
    
    def check_and_rest_if_needed(self):
        """
        检查全局请求计数，必要时休息
        
        每处理 REQUESTS_PER_BATCH 个请求后，所有worker统一休息 BATCH_REST_DURATION 秒
        使用 Redis 实现分布式计数和同步
        """
        # 如果限速功能被禁用，直接返回
        if not ENABLE_RATE_LIMIT:
            return
        
        import time
        
        # Redis keys
        request_counter_key = "crawler:request_counter"
        rest_until_key = "crawler:rest_until"
        
        # 检查是否正在休息
        rest_until = self.redis_client.get(rest_until_key)
        if rest_until:
            rest_until_time = float(rest_until.decode('utf-8'))
            now = time.time()
            if now < rest_until_time:
                # 正在休息中
                sleep_time = rest_until_time - now
                logger.info(f"🛑 全局限速: 休息中，还需等待 {int(sleep_time)} 秒...")
                time.sleep(sleep_time)
                return
        
        # 原子性递增请求计数
        current_count = self.redis_client.incr(request_counter_key)
        
        # 检查是否达到批次限制
        if current_count >= REQUESTS_PER_BATCH:
            # 设置休息时间
            rest_until_time = time.time() + BATCH_REST_DURATION
            self.redis_client.set(rest_until_key, str(rest_until_time), ex=BATCH_REST_DURATION + 10)
            
            # 重置计数器
            self.redis_client.set(request_counter_key, "0")
            
            logger.warning(
                f"⏸️  全局限速: 已处理 {current_count} 个请求，"
                f"休息 {BATCH_REST_DURATION} 秒..."
            )
            time.sleep(BATCH_REST_DURATION)
            logger.info("▶️  全局限速: 休息结束，继续爬取")
    
    def add_urls(self, urls: List[str], depth: int = 0):
        """批量添加URL到任务队列"""
        added_count = 0
        for url in urls:
            if self.add_url(url, depth):
                added_count += 1
        
        logger.info(f"Added {added_count}/{len(urls)} URLs to task queue")
        return added_count
    
    def add_url(self, url: str, depth: int = 0) -> bool:
        """添加单个URL到任务队列"""
        # 验证URL
        if not self.is_valid_url(url):
            return False
        
        normalized_url = self.normalize_url(url)
        
        # 检查是否已访问
        if self.is_visited(normalized_url):
            return False
        
        # 添加到任务队列（使用 JSON 格式）
        try:
            import json
            task_data = {
                'url': normalized_url,
                'depth': depth
            }
            # 统一使用 JSON 格式（更通用、易调试）
            self.redis_client.rpush(TASK_QUEUE_KEY, json.dumps(task_data))
            return True
        except Exception as e:
            logger.error(f"Failed to add URL to queue: {e}")
            return False
    
    def get_next_url(self) -> Optional[dict]:
        """从任务队列获取下一个URL（兼容 JSON 和 pickle 格式）"""
        try:
            import json
            task_data = self.redis_client.lpop(TASK_QUEUE_KEY)
            if not task_data:
                return None
            
            # 优先尝试 JSON 格式（新格式）
            try:
                if isinstance(task_data, bytes):
                    task_data = task_data.decode('utf-8')
                return json.loads(task_data)
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
                # JSON 失败，尝试 pickle 格式（兼容旧数据）
                try:
                    if isinstance(task_data, str):
                        task_data = task_data.encode('utf-8')
                    return pickle.loads(task_data)
                except Exception as pickle_error:
                    logger.error(f"Failed to deserialize task (tried JSON and pickle): {pickle_error}")
                    return None
        except Exception as e:
            logger.error(f"Failed to get URL from queue: {e}")
            return None
    
    def get_queue_size(self) -> int:
        """获取任务队列大小"""
        try:
            return self.redis_client.llen(TASK_QUEUE_KEY)
        except Exception:
            return 0
    
    def get_visited_count(self) -> int:
        """获取已访问URL数量（实时从Redis加载）"""
        try:
            bloom_data = self.redis_client.get(BLOOMFILTER_KEY)
            if bloom_data:
                bloom_filter = pickle.loads(bloom_data)
                return bloom_filter.count
        except Exception as e:
            logger.warning(f"Failed to get visited count from Redis: {e}")
        
        # 如果加载失败，返回本地缓存的计数
        return self.bloom_filter.count
    
    def extract_links(self, base_url: str, html_content: str) -> List[str]:
        """从HTML中提取所有链接"""
        from bs4 import BeautifulSoup
        
        links = []
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                # 转换相对URL为绝对URL
                absolute_url = urljoin(base_url, href)
                
                if self.is_valid_url(absolute_url):
                    links.append(absolute_url)
        
        except Exception as e:
            logger.error(f"Failed to extract links from {base_url}: {e}")
        
        return links
    
    def clear_all(self):
        """清空所有数据（开发/调试用）"""
        try:
            self.redis_client.delete(BLOOMFILTER_KEY)
            self.redis_client.delete(TASK_QUEUE_KEY)
            self.bloom_filter = BloomFilter(capacity=BLOOMFILTER_CAPACITY, error_rate=BLOOMFILTER_ERROR_RATE)
            logger.info("Cleared all URL data")
        except Exception as e:
            logger.error(f"Failed to clear URL data: {e}")
    
    def save(self):
        """保存当前状态"""
        self._save_bloom_filter()
        logger.info(f"Saved Bloomfilter with {self.bloom_filter.count} items")
