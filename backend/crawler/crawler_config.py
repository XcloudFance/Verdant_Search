"""
爬虫配置文件
"""
import os
from typing import List

# Redis 配置（与主项目保持一致）
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_CRAWLER_DB = int(os.getenv("REDIS_CRAWLER_DB", 1))  # 使用DB 1，避免与缓存(DB 0)冲突
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# Bloomfilter 配置
BLOOMFILTER_KEY = "crawler:visited_urls"
BLOOMFILTER_ERROR_RATE = 0.001  # 错误率
BLOOMFILTER_CAPACITY = 10000000  # 预计爬取1000万个URL

# 任务队列配置
TASK_QUEUE_KEY = "crawler:task_queue"

# 爬虫配置
# DrissionPage 模式: 's' (session/快速) 或 'd' (driver/浏览器)
DRISSION_MODE = 'd'  # ⚠️ 改为浏览器模式，确保 JS 渲染

# 浏览器配置（d 模式使用）
HEADLESS = False  # ⚠️ 显示浏览器窗口（headful）
BROWSER_PATH = None  # None 表示自动检测，或指定浏览器路径
PAGE_LOAD_WAIT = 10  # ⚠️ 等待页面加载的秒数（给 JS 渲染时间）

# User-Agent（s 模式使用）
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

REQUEST_TIMEOUT = 30  # 秒
MAX_RETRIES = 3
REQUEST_DELAY = 5.0  # 请求间隔（秒）- 增加以减少数据库竞争

# 全局限速配置
ENABLE_RATE_LIMIT = True
REQUESTS_PER_BATCH = int(os.getenv("REQUESTS_PER_BATCH", 10))  # 每批请求数
BATCH_REST_DURATION = int(os.getenv("BATCH_REST_DURATION", 50))  # 休息时长（秒）

# 是否自动切换模式（遇到 JS 渲染页面时切换到 d 模式）
AUTO_SWITCH_MODE = True  # 暂时关闭，避免复杂度

# 内容提取配置
MIN_CONTENT_LENGTH = 100  # 最小内容长度
MAX_CONTENT_LENGTH = 50000  # 最大内容长度

# 进程配置
NUM_WORKERS = int(os.getenv("CRAWLER_WORKERS", 3))  # 并发进程数（降低以减少数据库竞争）

# 种子URL（可通过环境变量覆盖）
DEFAULT_SEED_URLS: List[str] = [
]

# URL过滤规则
EXCLUDED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.css', '.js', '.json', '.xml',
]

# 允许的域名（为空则不限制）
ALLOWED_DOMAINS: List[str] = []  # 例如: ["python.org", "docs.python.org"]

# 最大爬取深度（0表示不限制）
MAX_DEPTH = int(os.getenv("CRAWLER_MAX_DEPTH", 0))
