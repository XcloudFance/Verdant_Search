"""
网页内容提取器 - 使用 trafilatura 和 readability
"""
import logging
from typing import Optional, Dict
import trafilatura
from readability import Document as ReadabilityDocument

from crawler_config import MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH

logger = logging.getLogger(__name__)


class ContentExtractor:
    """网页内容提取器 - 使用专业的内容提取库"""
    
    def extract(self, html: str, url: str) -> Optional[Dict[str, str]]:
        """
        从HTML中提取标题和正文内容
        
        优先使用 trafilatura，失败则使用 readability
        
        Returns:
            dict: {'title': str, 'content': str} 或 None
        """
        # 方法1: 使用 trafilatura（推荐，专为网页正文提取设计）
        result = self._extract_with_trafilatura(html, url)
        if result:
            return result
        
        # 方法2: 使用 readability（备用方案）
        result = self._extract_with_readability(html, url)
        if result:
            return result
        
        logger.warning(f"Failed to extract content from {url}")
        return None
    
    def _extract_with_trafilatura(self, html: str, url: str) -> Optional[Dict[str, str]]:
        """使用 trafilatura 提取内容"""
        try:
            # trafilatura 提取正文
            content = trafilatura.extract(
                html,
                include_comments=False,
                include_tables=True,
                no_fallback=False,
                favor_precision=True,  # 优先精确度
                url=url
            )
            
            if not content:
                return None
            
            # 获取标题 - 优先使用 <title> 标签（浏览器显示的标题）
            title = self._extract_title_fallback(html)
            
            # 如果 <title> 提取失败，再尝试 trafilatura 元数据
            if not title:
                metadata = trafilatura.extract_metadata(html)
                if metadata:
                    title = metadata.title or metadata.sitename
            
            # 验证内容
            if not title or not content:
                return None
            
            if len(content) < MIN_CONTENT_LENGTH:
                logger.debug(f"Content too short for {url}: {len(content)} chars")
                return None
            
            if len(content) > MAX_CONTENT_LENGTH:
                content = content[:MAX_CONTENT_LENGTH]
                logger.debug(f"Content truncated for {url}")
            
            return {
                'title': self._clean_text(title),
                'content': self._clean_text(content)
            }
        
        except Exception as e:
            logger.debug(f"Trafilatura extraction failed for {url}: {e}")
            return None
    
    def _extract_with_readability(self, html: str, url: str) -> Optional[Dict[str, str]]:
        """使用 readability 提取内容（备用方案）"""
        try:
            doc = ReadabilityDocument(html)
            
            # 提取标题
            title = doc.short_title() or doc.title()
            
            # 提取正文（HTML格式）
            content_html = doc.summary()
            
            # 转换为纯文本
            from lxml import html as lxml_html
            content_tree = lxml_html.fromstring(content_html)
            content = content_tree.text_content()
            
            # 验证内容
            if not title or not content:
                return None
            
            if len(content) < MIN_CONTENT_LENGTH:
                logger.debug(f"Content too short for {url}: {len(content)} chars")
                return None
            
            if len(content) > MAX_CONTENT_LENGTH:
                content = content[:MAX_CONTENT_LENGTH]
                logger.debug(f"Content truncated for {url}")
            
            return {
                'title': self._clean_text(title),
                'content': self._clean_text(content)
            }
        
        except Exception as e:
            logger.debug(f"Readability extraction failed for {url}: {e}")
            return None
    
    def _extract_title_fallback(self, html: str) -> Optional[str]:
        """备用标题提取方法"""
        try:
            from lxml import html as lxml_html
            tree = lxml_html.fromstring(html)
            
            # 尝试多种方式提取标题
            # 1. og:title
            og_title = tree.xpath('//meta[@property="og:title"]/@content')
            if og_title:
                return og_title[0]
            
            # 2. title tag
            title = tree.xpath('//title/text()')
            if title:
                return title[0]
            
            # 3. h1 tag
            h1 = tree.xpath('//h1/text()')
            if h1:
                return h1[0]
            
            return None
        except Exception:
            return None
    
    def _clean_text(self, text: str) -> str:
        """清理文本"""
        if not text:
            return ""
        
        import re
        
        # 移除多余空白
        text = re.sub(r'\s+', ' ', text)
        
        # 移除首尾空白
        text = text.strip()
        
        return text
