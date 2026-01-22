from typing import List, Optional, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from models import Document, DocumentEmbedding, ImageEmbedding
from embedding_service import get_embedding_service
from tokenizer_service import get_tokenizer_service
import numpy as np

class IndexService:
    """Service for indexing documents into the database"""
    
    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.tokenizer_service = get_tokenizer_service()
    
    def preprocess_text(self, text: str) -> str:
        """
        Preprocess text with tokenization
        
        Returns tokenized text joined with spaces
        """
        tokens = self.tokenizer_service.tokenize(text, mode="search")
        return " ".join(tokens)
    
    async def index_document(
        self,
        title: str,
        content: str,
        session: AsyncSession,
        url: Optional[str] = None,
        source_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
        images: Optional[List[Dict]] = None
    ) -> int:
        """
        Index a single document with posting list and embedding
        
        ⚠️ UPSERT 逻辑：如果 URL 已存在，更新文档；否则创建新文档
        
        构建倒排索引和向量索引
        
        Args:
            images: List of image objects [{url, base64_data, alt_text, width, height}]
        
        Returns:
            Document ID
        """
        from posting_list_manager import get_posting_list_manager
        
        # Store original in metadata
        if metadata is None:
            metadata = {}
        metadata["original_title"] = title
        metadata["original_content"] = content
        
        # ============ UPSERT 逻辑 ============
        # 如果提供了 URL，检查是否已存在
        existing_doc = None
        if url:
            result = await session.execute(
                select(Document).where(Document.url == url)
            )
            existing_doc = result.scalar_one_or_none()
        
        if existing_doc:
            # URL 已存在 → 更新文档
            print(f"🔄 UPSERT: URL 已存在，更新文档 ID={existing_doc.id}: {url}")
            
            # 1. 删除旧的 posting list 和 embedding
            posting_manager = get_posting_list_manager()
            await posting_manager.delete_posting_list(existing_doc.id, session)
            
            # 删除旧 embedding (文本和图片)
            await session.execute(
                text("DELETE FROM document_embeddings WHERE document_id = :doc_id"),
                {"doc_id": existing_doc.id}
            )
            await session.execute(
                text("DELETE FROM image_embeddings WHERE document_id = :doc_id"),
                {"doc_id": existing_doc.id}
            )
            
            # 2. 更新文档内容
            existing_doc.title = title
            existing_doc.content = content
            existing_doc.source_type = source_type
            existing_doc.doc_metadata = metadata
            existing_doc.images = images  # 更新图片
            
            await session.flush()
            document = existing_doc
        else:
            # URL 不存在 → 创建新文档
            print(f"➕ UPSERT: 创建新文档: {url or '(no URL)'}")
            document = Document(
                title=title,
                content=content,
                url=url,
                source_type=source_type,
                doc_metadata=metadata,
                images=images  # 保存图片
            )
            session.add(document)
            await session.flush()  # Get the ID
        
        # Build posting list (构建倒排索引)
        posting_manager = get_posting_list_manager()
        await posting_manager.build_posting_list(
            document_id=document.id,
            title=title,
            content=content,
            session=session
        )
        
        # Generate embedding from original text (向量索引)
        text_to_embed = f"{title}. {content}"
        embedding = self.embedding_service.encode_text(text_to_embed)[0]
        
        # Store embedding
        doc_embedding = DocumentEmbedding(
            document_id=document.id,
            embedding=embedding.tolist()
        )
        session.add(doc_embedding)
        
        # 处理图片 Embedding
        if images:
             # 限制处理前4张图片
             for i, img in enumerate(images[:4]):
                 base64_data = img.get("base64_data")
                 if base64_data:
                     try:
                         # 使用 base64 生成 embedding
                         img_embedding = self.embedding_service.encode_image_base64(base64_data)
                         
                         img_emb_record = ImageEmbedding(
                             document_id=document.id,
                             image_index=i,
                             embedding=img_embedding.tolist()
                         )
                         session.add(img_emb_record)
                     except Exception as e:
                         print(f"Failed to generate image embedding for doc {document.id} img {i}: {e}")

        await session.commit()
        
        return document.id
    
    async def batch_index_documents(
        self,
        documents: List[Dict[str, Any]],
        session: AsyncSession
    ) -> List[int]:
        """
        Index multiple documents in batch
        
        Args:
            documents: List of dicts with keys: title, content, url, source_type, metadata
        
        Returns:
            List of document IDs
        """
        doc_ids = []
        
        for doc_data in documents:
            doc_id = await self.index_document(
                title=doc_data["title"],
                content=doc_data["content"],
                url=doc_data.get("url"),
                source_type=doc_data.get("source_type", "text"),
                metadata=doc_data.get("metadata"),
                session=session
            )
            doc_ids.append(doc_id)
        
        return doc_ids
    
    async def get_document(
        self,
        document_id: int,
        session: AsyncSession
    ) -> Optional[Document]:
        """Get document by ID"""
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()
    
    async def delete_document(
        self,
        document_id: int,
        session: AsyncSession
    ) -> bool:
        """Delete document, its embeddings and posting list"""
        from posting_list_manager import get_posting_list_manager
        
        document = await self.get_document(document_id, session)
        if document:
            # Delete posting list first
            posting_manager = get_posting_list_manager()
            await posting_manager.delete_posting_list(document_id, session)
            
            # Delete document (cascades to embeddings)
            await session.delete(document)
            await session.commit()
            return True
        return False
    
    async def get_all_documents(
        self,
        session: AsyncSession,
        limit: int = 100,
        offset: int = 0
    ) -> List[Document]:
        """Get all documents with pagination"""
        result = await session.execute(
            select(Document)
            .order_by(Document.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

# Global index service instance
index_service = None

def get_index_service() -> IndexService:
    """Get or create index service singleton"""
    global index_service
    if index_service is None:
        index_service = IndexService()
    return index_service
