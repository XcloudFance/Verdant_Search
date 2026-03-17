-- Migration 003: Distributed crawler fleet management tables

CREATE TABLE IF NOT EXISTS crawler_workers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    ip_address VARCHAR(50),
    hostname VARCHAR(255),
    version VARCHAR(50),
    capabilities TEXT[],
    group_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'IDLE',
    jobs_completed INTEGER DEFAULT 0,
    jobs_failed INTEGER DEFAULT 0,
    pages_per_min FLOAT DEFAULT 0,
    last_heartbeat_at TIMESTAMP,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deregistered BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
    id SERIAL PRIMARY KEY,
    seed_url TEXT NOT NULL,
    max_depth INTEGER DEFAULT 3,
    max_pages INTEGER DEFAULT 1000,
    allowed_domains TEXT[],
    content_types TEXT[],
    js_rendering BOOLEAN DEFAULT false,
    crawl_frequency VARCHAR(100) DEFAULT 'once',
    status VARCHAR(20) DEFAULT 'pending',
    group_name VARCHAR(100),
    pages_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawl_logs (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(36) REFERENCES crawler_workers(id) ON DELETE SET NULL,
    job_id INTEGER REFERENCES crawl_jobs(id) ON DELETE SET NULL,
    url TEXT,
    status_code INTEGER,
    latency_ms INTEGER,
    content_type VARCHAR(100),
    word_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    error_msg TEXT,
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawler_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    rate_limit FLOAT DEFAULT 1.0,
    paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS crawler_workers_status_idx ON crawler_workers(status);
CREATE INDEX IF NOT EXISTS crawl_jobs_status_idx ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS crawl_logs_worker_id_idx ON crawl_logs(worker_id);
CREATE INDEX IF NOT EXISTS crawl_logs_crawled_at_idx ON crawl_logs(crawled_at DESC);
