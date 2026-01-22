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
