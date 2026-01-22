from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
import uvicorn

from database import get_db, init_db
from search_service import get_search_service, SearchService
from index_service import get_index_service, IndexService
from llm_service import get_llm_service, LLMService
from cache_service import get_cache_service, CacheService
from analytics_router import router as analytics_router
from config import settings


app = FastAPI(title="Verdant Search - Python API", version="1.0.0")

app.include_router(analytics_router)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:5178",
        "http://127.0.0.1:5179"
    ],



    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for requests/responses
class SearchRequest(BaseModel):
    query: str
    page: Optional[int] = 1
    page_size: Optional[int] = 10
    top_k: Optional[int] = None  # 保留兼容性，如果不提供则使用 page * page_size

class ImageInfo(BaseModel):
    url: str
    base64_data: Optional[str] = None
    alt_text: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

class ImageSearchRequest(BaseModel):
    image: str
    top_k: Optional[int] = 10

class SearchResult(BaseModel):
    id: int
    title: str
    url: Optional[str]
    snippet: str
    score: float
    source_type: str
    images: Optional[List[ImageInfo]] = None

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
    page: int
    page_size: int
    total_pages: int

class IndexDocumentRequest(BaseModel):
    title: str
    content: str
    url: Optional[str] = None
    source_type: str = "text"
    metadata: Optional[Dict[str, Any]] = None

class IndexDocumentResponse(BaseModel):
    document_id: int
    message: str

class BatchIndexRequest(BaseModel):
    documents: List[IndexDocumentRequest]

class BatchIndexResponse(BaseModel):
    document_ids: List[int]
    count: int
    message: str

class SummaryRequest(BaseModel):
    query: str
    results: List[Dict[str, Any]]
    skip_cache: Optional[bool] = False

class SummaryResponse(BaseModel):
    summary: str

class ChatRequest(BaseModel):
    message: str
    query: str
    results: Optional[List[Dict[str, Any]]] = None  # Make optional
    document_ids: Optional[List[int]] = None  # New field for efficiency
    history: Optional[List[Dict[str, str]]] = None

class ChatResponse(BaseModel):
    response: str

class QuestionsRequest(BaseModel):
    query: str
    results: List[Dict[str, Any]]

class QuestionsResponse(BaseModel):
    questions: List[str]

class RefineQueryRequest(BaseModel):
    original_query: str
    chat_history: List[Dict[str, str]]

class RefineQueryResponse(BaseModel):
    refined_query: str

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    await init_db()
    # Pre-load embedding model
    get_search_service()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Verdant Search Python API",
        "status": "ok",
        "version": "1.0.0"
    }

@app.post("/api/tokenize")
async def tokenize_text(text: str):
    """
    Tokenize text using jieba
    
    Useful for debugging and testing tokenization
    """
    from tokenizer_service import get_tokenizer_service
    tokenizer = get_tokenizer_service()
    
    tokens = tokenizer.tokenize(text, mode="search")
    keywords = tokenizer.extract_keywords(text, top_k=10)
    
    return {
        "original": text,
        "tokens": tokens,
        "keywords": keywords,
        "token_count": len(tokens)
    }

@app.post("/api/search", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Hybrid search endpoint combining BM25 and vector search
    
    支持分页：page=页码(从1开始), page_size=每页数量
    Returns paginated results ranked by combined score
    """
    try:
        # 计算需要获取的总结果数（获取更多结果以便分页）
        # 获取前 max(100, page * page_size) 个结果
        if request.top_k is not None:
            fetch_count = request.top_k
        else:
            fetch_count = max(100, request.page * request.page_size)
        
        # Perform hybrid search
        search_results = await search_service.search(
            query=request.query,
            session=db,
            top_k=fetch_count
        )
        
        # 总结果数
        total_results = len(search_results)
        
        # 计算分页
        page = max(1, request.page)
        page_size = request.page_size
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        # 分页切片
        paginated_results = search_results[start_idx:end_idx]
        
        # Fetch full document details for current page
        results = []
        index_service = get_index_service()
        
        for result in paginated_results:
            doc_id = result["document_id"]
            score = result["score"]
            
            # Get document from database
            document = await index_service.get_document(doc_id, db)
            if document:
                # Create snippet (first 200 chars of content)
                snippet = document.content[:200] + "..." if len(document.content) > 200 else document.content
                
                results.append(SearchResult(
                    id=document.id,
                    title=document.title,
                    url=document.url or "",
                    snippet=snippet,
                    score=score,
                    source_type=document.source_type or "text",
                    images=document.images  # 传递图片数据
                ))
        
        # 计算总页数
        total_pages = (total_results + page_size - 1) // page_size
        
        response = SearchResponse(
            query=request.query,
            results=results,
            total=total_results,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        return response
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@app.post("/api/search/image", response_model=SearchResponse)
async def search_by_image(
    request: ImageSearchRequest,
    db: AsyncSession = Depends(get_db),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Search documents using an image (Image-to-Text search)
    """
    try:
        # Perform image search
        search_results = await search_service.search_by_image(
            image_base64=request.image,
            session=db,
            top_k=request.top_k or 10
        )
        
        # Fetch full document details
        results = []
        index_service = get_index_service()
        
        for result in search_results:
            doc_id = result["document_id"]
            score = result["score"]
            
            # Get document from database
            document = await index_service.get_document(doc_id, db)
            if document:
                # Create snippet
                snippet = document.content[:200] + "..." if len(document.content) > 200 else document.content
                
                results.append(SearchResult(
                    id=document.id,
                    title=document.title,
                    url=document.url or "",
                    snippet=snippet,
                    score=score,
                    source_type=document.source_type or "text",
                    images=document.images
                ))
        
        return SearchResponse(
            query="[Image Search]",
            results=results,
            total=len(results),
            page=1,
            page_size=len(results),
            total_pages=1
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image search failed: {str(e)}"
        )

@app.get("/api/suggestions")
async def get_suggestions(
    q: str,
    search_service: SearchService = Depends(get_search_service)
):
    """
    Get search suggestions based on query prefix
    """
    return {
        "suggestions": search_service.get_suggestions(q, limit=5)
    }

@app.post("/api/index", response_model=IndexDocumentResponse)
async def index_document(
    request: IndexDocumentRequest,
    db: AsyncSession = Depends(get_db),
    index_service: IndexService = Depends(get_index_service)
):
    """
    Index a single document
    
    Creates document record and generates embedding
    """
    try:
        doc_id = await index_service.index_document(
            title=request.title,
            content=request.content,
            url=request.url,
            source_type=request.source_type,
            metadata=request.metadata,
            session=db
        )
        
        return IndexDocumentResponse(
            document_id=doc_id,
            message="Document indexed successfully"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failed: {str(e)}"
        )

@app.post("/api/index/batch", response_model=BatchIndexResponse)
async def batch_index_documents(
    request: BatchIndexRequest,
    db: AsyncSession = Depends(get_db),
    index_service: IndexService = Depends(get_index_service)
):
    """
    Batch index multiple documents
    
    Efficiently indexes multiple documents at once
    """
    try:
        docs_data = [doc.dict() for doc in request.documents]
        
        doc_ids = await index_service.batch_index_documents(
            documents=docs_data,
            session=db
        )
        
        return BatchIndexResponse(
            document_ids=doc_ids,
            count=len(doc_ids),
            message=f"Indexed {len(doc_ids)} documents successfully"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch indexing failed: {str(e)}"
        )

@app.get("/api/documents")
async def list_documents(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    index_service: IndexService = Depends(get_index_service)
):
    """
    List all indexed documents
    """
    try:
        documents = await index_service.get_all_documents(
            session=db,
            limit=limit,
            offset=offset
        )
        
        return {
            "documents": [
                {
                    "id": doc.id,
                    "title": doc.title,
                    "url": doc.url,
                    "source_type": doc.source_type,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None
                }
                for doc in documents
            ],
            "count": len(documents)
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list documents: {str(e)}"
        )

@app.delete("/api/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    index_service: IndexService = Depends(get_index_service)
):
    """Delete a document by ID"""
    try:
        success = await index_service.delete_document(document_id, db)
        if success:
            return {"message": f"Document {document_id} deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {document_id} not found"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )

@app.post("/api/llm/summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryRequest,
    llm_service: LLMService = Depends(get_llm_service),
    cache_service: CacheService = Depends(get_cache_service)
):
    """
    Generate AI summary of search results (with caching)
    
    Args:
        query: The search query
        results: List of search results
    
    Returns:
        AI-generated summary in English
    """
    try:
        # Extract result IDs for cache key
        result_ids = [r.get('id') for r in request.results if r.get('id')]
        
        # Try to get from cache first (sync method), unless skipped
        if not request.skip_cache:
            cached_summary = cache_service.get_summary(request.query, result_ids)
            if cached_summary:
                return SummaryResponse(summary=cached_summary)
        
        # Generate new summary (sync method)
        summary = llm_service.generate_search_summary(
            query=request.query,
            search_results=request.results
        )
        
        # Cache the result (sync method)
        cache_service.set_summary(request.query, summary, result_ids)
        
        return SummaryResponse(summary=summary)
    
    except Exception as e:
        import traceback
        print(f"Summary generation error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}"
        )

@app.post("/api/llm/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),  # Need DB session
    llm_service: LLMService = Depends(get_llm_service),
    index_service: IndexService = Depends(get_index_service)
):
    """
    Chat with AI about search results
    
    The AI has access to the search results and can answer questions about them.
    If 'document_ids' are provided, fetches full document details including images.
    """
    try:
        search_results = request.results or []
        
        # If document_ids are provided, fetch full details from DB
        if request.document_ids:
            fetched_results = []
            for doc_id in request.document_ids:
                doc = await index_service.get_document(doc_id, db)
                if doc:
                    fetched_results.append({
                        "id": doc.id,
                        "title": doc.title,
                        "url": doc.url,
                        "snippet": doc.content,  # Use full content for context
                        "source_type": doc.source_type,
                        "images": doc.images  # Include images
                    })
            if fetched_results:
                search_results = fetched_results
        
        response = llm_service.chat_with_context(
            user_message=request.message,
            search_results=search_results,
            query=request.query,
            chat_history=request.history
        )
        
        return ChatResponse(response=response)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )

@app.post("/api/llm/suggest-questions", response_model=QuestionsResponse)
async def suggest_questions(
    request: QuestionsRequest,
    llm_service: LLMService = Depends(get_llm_service),
    cache_service: CacheService = Depends(get_cache_service)
):
    """
    Generate related questions based on search results (with caching)
    
    Returns 3-6 relevant follow-up questions (cached if available)
    """
    try:
        # Extract result IDs for cache key
        result_ids = [r.get('id') for r in request.results if r.get('id')]
        
        # Try to get from cache
        cached_questions = cache_service.get_questions(request.query, result_ids)
        if cached_questions:
            return QuestionsResponse(questions=cached_questions)
        
        # Generate new questions
        questions = llm_service.generate_related_questions(
            query=request.query,
            search_results=request.results
        )
        
        # Cache the result
        cache_service.set_questions(request.query, questions, result_ids)
        
        return QuestionsResponse(questions=questions)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "verdant-python-api"}

@app.post("/api/llm/refine-query", response_model=RefineQueryResponse)
async def refine_search_query(
    request: RefineQueryRequest,
    llm_service: LLMService = Depends(get_llm_service)
):
    """
    Refine search query based on chat conversation
    
    Analyzes the conversation to understand user's true intent and generates
    optimized search keywords for iterative search
    """
    try:
        refined_query = llm_service.refine_search_query(
            original_query=request.original_query,
            chat_history=request.chat_history
        )
        
        return RefineQueryResponse(refined_query=refined_query)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query refinement failed: {str(e)}"
        )

@app.get("/api/cache/stats")
async def cache_stats(cache_service: CacheService = Depends(get_cache_service)):
    """Get cache statistics"""
    return cache_service.get_stats()

@app.delete("/api/cache/clear")
async def clear_cache(cache_service: CacheService = Depends(get_cache_service)):
    """Clear all cache (admin endpoint)"""
    cache_service.clear_all()
    return {"message": "Cache cleared successfully"}

if __name__ == "__main__":
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
