-- Initialize database with pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- Tables for Python Search Engine
-- ========================================

-- Documents table for storing indexed content
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    source_type VARCHAR(50),
    doc_metadata JSONB,
    doc_length INTEGER DEFAULT 0,  -- 文档长度（分词后的token数）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Terms table (词项表)
CREATE TABLE IF NOT EXISTS terms (
    id SERIAL PRIMARY KEY,
    term VARCHAR(255) UNIQUE NOT NULL,  -- 分词后的词
    doc_frequency INTEGER DEFAULT 0,     -- 包含该词的文档数(DF)
    total_frequency BIGINT DEFAULT 0,    -- 该词在所有文档中出现的总次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posting List table (倒排列表)
CREATE TABLE IF NOT EXISTS postings (
    id SERIAL PRIMARY KEY,
    term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    term_frequency INTEGER NOT NULL,     -- 该词在文档中的词频(TF)
    positions INTEGER[],                 -- 词在文档中的位置（可选，用于短语查询）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(term_id, document_id)
);

-- Document statistics (文档统计信息，用于BM25计算)
CREATE TABLE IF NOT EXISTS doc_stats (
    id SERIAL PRIMARY KEY,
    total_docs INTEGER DEFAULT 0,        -- 总文档数
    avg_doc_length FLOAT DEFAULT 0,      -- 平均文档长度
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化统计信息
INSERT INTO doc_stats (total_docs, avg_doc_length) VALUES (0, 0) 
ON CONFLICT DO NOTHING;

-- ========================================
-- Tables for Go Backend (Users & History)
-- Vector embeddings table with HNSW index (保留向量检索)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    embedding vector(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create HNSW index for fast vector search
CREATE INDEX IF NOT EXISTS document_embeddings_hnsw_idx 
ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Indexes for posting list (倒排索引优化)
CREATE INDEX IF NOT EXISTS terms_term_idx ON terms(term);
CREATE INDEX IF NOT EXISTS postings_term_id_idx ON postings(term_id);
CREATE INDEX IF NOT EXISTS postings_doc_id_idx ON postings(document_id);
CREATE INDEX IF NOT EXISTS postings_term_doc_idx ON postings(term_id, document_id);

-- Index for documents
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at DESC);

-- ========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Search history table
CREATE TABLE IF NOT EXISTS search_histories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Go tables
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users(deleted_at);
CREATE INDEX IF NOT EXISTS search_histories_user_id_idx ON search_histories(user_id);
CREATE INDEX IF NOT EXISTS search_histories_timestamp_idx ON search_histories(timestamp DESC);

-- ========================================
-- Tables for Crawler Fleet Management
-- ========================================

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

-- Indexes for crawler tables
CREATE INDEX IF NOT EXISTS crawler_workers_status_idx ON crawler_workers(status);
CREATE INDEX IF NOT EXISTS crawl_jobs_status_idx ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS crawl_logs_worker_id_idx ON crawl_logs(worker_id);
CREATE INDEX IF NOT EXISTS crawl_logs_crawled_at_idx ON crawl_logs(crawled_at DESC);
