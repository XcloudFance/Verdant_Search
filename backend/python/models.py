from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Float, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class Document(Base):
    """Document model for storing indexed content"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text, nullable=False, index=True)
    content = Column(Text, nullable=False)
    url = Column(Text)
    source_type = Column(String(50))
    doc_metadata = Column(JSON)  # Renamed from 'metadata' (reserved word in SQLAlchemy)
    doc_length = Column(Integer, default=0)  # Document length in tokens (for BM25)
    images = Column(JSON)  # Array of image objects: [{url, base64_data, alt_text, width, height}], max 4 images
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DocumentEmbedding(Base):
    """Document embedding model for vector search"""
    __tablename__ = "document_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    embedding = Column(Vector(512))  # CLIP embedding dimension
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ImageEmbedding(Base):
    """Image embedding model for image search"""
    __tablename__ = "image_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    image_index = Column(Integer)  # Index in the document.images list
    embedding = Column(Vector(512))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
class Term(Base):
    """Term model for storing unique terms"""
    __tablename__ = "terms"
    
    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(255), unique=True, nullable=False, index=True)
    doc_frequency = Column(Integer, default=0)  # DF: number of documents containing this term
    total_frequency = Column(Integer, default=0)  # Total occurrences across all documents
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Posting(Base):
    """Posting list model for inverted index"""
    __tablename__ = "postings"
    
    id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("terms.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    term_frequency = Column(Integer, nullable=False)  # TF: frequency in this document
    positions = Column(JSON)  # Array of positions where term appears
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        # 唯一约束：每个文档中的每个词只能有一条记录
        # 这样可以使用 ON CONFLICT (term_id, document_id) DO UPDATE
        UniqueConstraint('term_id', 'document_id', name='uq_posting_term_document'),
    )

class DocStats(Base):
    """Document statistics for BM25 calculation"""
    __tablename__ = "doc_stats"
    
    id = Column(Integer, primary_key=True)
    total_docs = Column(Integer, default=0)
    avg_doc_length = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
