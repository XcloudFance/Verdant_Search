-- Migration 002: Add images column to documents table
-- Stores up to 4 image objects per document: [{url, base64_data, alt_text, width, height}]

ALTER TABLE documents ADD COLUMN IF NOT EXISTS images JSONB;
