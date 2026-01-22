from typing import List, Dict
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tokenizer_service import get_tokenizer_service

class PostingListManager:
    """
    倒排索引管理器
    负责构建和维护posting list
    """
    
    def __init__(self):
        self.tokenizer = get_tokenizer_service()
    
    async def build_posting_list(
        self,
        document_id: int,
        title: str,
        content: str,
        session: AsyncSession
    ):
        """
        为文档构建posting list
        
        Args:
            document_id: 文档ID
            title: 文档标题
            content: 文档内容
            session: 数据库会话
        """
        # 合并标题和内容后分词
        full_text = f"{title} {content}"
        tokens = self.tokenizer.tokenize(full_text, mode="search")
        
        if not tokens:
            return
        
        # 计算词频和位置
        term_stats = {}  # {term: {"tf": count, "positions": [pos1, pos2, ...]}}
        
        for pos, token in enumerate(tokens):
            if token not in term_stats:
                term_stats[token] = {"tf": 0, "positions": []}
            term_stats[token]["tf"] += 1
            term_stats[token]["positions"].append(pos)
        
        # 更新文档长度
        doc_length = len(tokens)
        update_doc_query = text("""
            UPDATE documents SET doc_length = :doc_length WHERE id = :doc_id
        """)
        await session.execute(update_doc_query, {
            "doc_length": doc_length,
            "doc_id": document_id
        })
        
        # 为每个词创建或更新term，并创建posting
        for term, stats in term_stats.items():
            # 获取或创建term
            term_id = await self._get_or_create_term(term, session)
            
            # 创建posting
            await self._create_posting(
                term_id=term_id,
                document_id=document_id,
                term_frequency=stats["tf"],
                positions=stats["positions"],
                session=session
            )
        
        # 更新文档统计信息
        await self._update_doc_stats(session)
    
    async def _get_or_create_term(self, term: str, session: AsyncSession) -> int:
        """
        获取或创建term，返回term_id
        
        使用 ON CONFLICT DO NOTHING 避免并发插入同一个 term 时的死锁
        """
        # 方案：先尝试插入，如果冲突则查询
        # 这样避免了 SELECT-then-INSERT 的竞态条件
        
        insert_query = text("""
            INSERT INTO terms (term, doc_frequency, total_frequency)
            VALUES (:term, 0, 0)
            ON CONFLICT (term) DO NOTHING
            RETURNING id
        """)
        
        result = await session.execute(insert_query, {"term": term})
        await session.flush()  # 确保插入完成
        row = result.first()
        
        if row:
            # 插入成功，返回新 ID
            return row[0]
        
        # 插入冲突（term 已存在），查询现有 ID
        select_query = text("SELECT id FROM terms WHERE term = :term")
        result = await session.execute(select_query, {"term": term})
        row = result.first()
        
        if row:
            return row[0]
        
        # 理论上不应该到这里，但以防万一
        raise Exception(f"Failed to get or create term: {term}")
    
    async def _create_posting(
        self,
        term_id: int,
        document_id: int,
        term_frequency: int,
        positions: List[int],
        session: AsyncSession
    ):
        """创建posting记录"""
        import json
        
        # 插入posting
        insert_query = text("""
            INSERT INTO postings (term_id, document_id, term_frequency, positions)
            VALUES (:term_id, :document_id, :term_frequency, :positions)
            ON CONFLICT (term_id, document_id) 
            DO UPDATE SET term_frequency = :term_frequency, positions = :positions
        """)
        await session.execute(insert_query, {
            "term_id": term_id,
            "document_id": document_id,
            "term_frequency": term_frequency,
            "positions": json.dumps(positions)  # 转换为 JSON 字符串
        })
        
        # ========== 移除实时统计更新，避免死锁 ==========
        # 统计信息将通过独立的后台任务定期批量更新
        # 见: backend/python/update_term_stats.py
        # 
        # 原代码（已注释，避免死锁）：
        # update_df_query = text("""
        #     UPDATE terms 
        #     SET doc_frequency = (
        #         SELECT COUNT(DISTINCT document_id) 
        #         FROM postings 
        #         WHERE term_id = :term_id
        #     ),
        #     total_frequency = (
        #         SELECT COALESCE(SUM(term_frequency), 0)
        #         FROM postings
        #         WHERE term_id = :term_id
        #     )
        #     WHERE id = :term_id
        # """)
        # await session.execute(update_df_query, {"term_id": term_id})
    
    async def _update_doc_stats(self, session: AsyncSession):
        """更新全局文档统计信息"""
        # 计算总文档数和平均文档长度
        stats_query = text("""
            SELECT 
                COUNT(*) as total_docs,
                COALESCE(AVG(doc_length), 0) as avg_doc_length
            FROM documents
            WHERE doc_length > 0
        """)
        result = await session.execute(stats_query)
        row = result.first()
        
        if row:
            total_docs, avg_doc_length = row[0], row[1]
            
            # 更新doc_stats表
            update_query = text("""
                INSERT INTO doc_stats (id, total_docs, avg_doc_length, updated_at)
                VALUES (1, :total_docs, :avg_doc_length, CURRENT_TIMESTAMP)
                ON CONFLICT (id) 
                DO UPDATE SET 
                    total_docs = :total_docs,
                    avg_doc_length = :avg_doc_length,
                    updated_at = CURRENT_TIMESTAMP
            """)
            await session.execute(update_query, {
                "total_docs": total_docs,
                "avg_doc_length": avg_doc_length
            })
    
    async def delete_posting_list(self, document_id: int, session: AsyncSession):
        """删除文档的posting list"""
        # 删除posting记录
        delete_postings_query = text("""
            DELETE FROM postings WHERE document_id = :document_id
        """)
        await session.execute(delete_postings_query, {"document_id": document_id})
        
        # 更新所有受影响的terms的统计信息
        update_terms_query = text("""
            UPDATE terms
            SET doc_frequency = (
                SELECT COUNT(DISTINCT document_id)
                FROM postings
                WHERE term_id = terms.id
            ),
            total_frequency = (
                SELECT COALESCE(SUM(term_frequency), 0)
                FROM postings
                WHERE term_id = terms.id
            )
        """)
        await session.execute(update_terms_query)
        
        # 删除没有posting的terms
        cleanup_terms_query = text("""
            DELETE FROM terms WHERE doc_frequency = 0
        """)
        await session.execute(cleanup_terms_query)
        
        # 更新文档统计
        await self._update_doc_stats(session)

# 全局posting list管理器
posting_list_manager = None

def get_posting_list_manager() -> PostingListManager:
    """获取posting list管理器单例"""
    global posting_list_manager
    if posting_list_manager is None:
        posting_list_manager = PostingListManager()
    return posting_list_manager
