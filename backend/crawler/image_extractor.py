"""
图片提取器 - 从网页中提取和处理图片
"""
import logging
import base64
import requests
from typing import List, Dict, Optional
from urllib.parse import urljoin
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

class ImageExtractor:
    """从HTML中提取图片并转换为base64"""
    
    MAX_IMAGES = 4  # 每个文档最多保存4张图片
    MAX_IMAGE_SIZE = 500  # KB
    MIN_IMAGE_WIDTH = 200  # 最小宽度
    MIN_IMAGE_HEIGHT = 200  # 最小高度
    RESIZE_WIDTH = 800  # 压缩后的最大宽度
    
    ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    
    def extract_images(self, html: str, base_url: str) -> List[Dict]:
        """
        从HTML中提取图片
        
        Args:
            html: HTML内容
            base_url: 页面URL（用于解析相对路径）
            
        Returns:
            图片信息列表: [{url, base64_data, alt_text, width, height}]
        """
        from bs4 import BeautifulSoup
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            img_tags = soup.find_all('img')
            
            images = []
            processed_urls = set()  # 避免重复
            
            for img in img_tags:
                if len(images) >= self.MAX_IMAGES:
                    break
                
                # 获取图片URL
                img_url = img.get('src') or img.get('data-src')
                if not img_url:
                    continue
                
                # 转换为绝对URL
                absolute_url = urljoin(base_url, img_url)
                
                # 跳过已处理的URL
                if absolute_url in processed_urls:
                    continue
                
                # 检查扩展名
                if not self._is_valid_image_url(absolute_url):
                    continue
                
                # 下载和处理图片
                image_data = self._download_and_process_image(
                    absolute_url,
                    img.get('alt', ''),
                    img.get('width'),
                    img.get('height')
                )
                
                if image_data:
                    images.append(image_data)
                    processed_urls.add(absolute_url)
            
            logger.info(f"Extracted {len(images)} images from {base_url}")
            return images
            
        except Exception as e:
            logger.error(f"Failed to extract images from {base_url}: {e}")
            return []
    
    def _is_valid_image_url(self, url: str) -> bool:
        """检查URL是否是有效的图片"""
        url_lower = url.lower()
        
        # 检查扩展名
        if not any(url_lower.endswith(ext) for ext in self.ALLOWED_EXTENSIONS):
            # 也检查是否包含扩展名（有些URL有查询参数）
            if not any(ext in url_lower for ext in self.ALLOWED_EXTENSIONS):
                return False
        
        # 排除常见的小图标
        if any(keyword in url_lower for keyword in ['icon', 'logo', 'favicon', 'sprite', 'pixel']):
            return False
        
        return True
    
    def _download_and_process_image(
        self, 
        url: str, 
        alt_text: str = "", 
        width: Optional[str] = None,
        height: Optional[str] = None
    ) -> Optional[Dict]:
        """
        下载图片并处理
        
        Returns:
            {url, base64_data, alt_text, width, height} or None
        """
        try:
            # 下载图片
            response = requests.get(
                url, 
                timeout=10,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            
            if response.status_code != 200:
                logger.debug(f"Failed to download image: {url} (status {response.status_code})")
                return None
            
            # 检查大小
            content_length = len(response.content)
            if content_length > self.MAX_IMAGE_SIZE * 1024:
                logger.debug(f"Image too large: {url} ({content_length / 1024:.1f} KB)")
                # 继续处理，但会压缩
            
            # 打开图片
            try:
                img = Image.open(BytesIO(response.content))
            except Exception as e:
                logger.debug(f"Failed to open image: {url} - {e}")
                return None
            
            # 转换为 RGB（去除 alpha 通道）
            if img.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if 'A' in img.mode else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 获取尺寸
            img_width, img_height = img.size
            
            # 检查最小尺寸
            if img_width < self.MIN_IMAGE_WIDTH or img_height < self.MIN_IMAGE_HEIGHT:
                logger.debug(f"Image too small: {url} ({img_width}x{img_height})")
                return None
            
            # 压缩大图片
            if img_width > self.RESIZE_WIDTH:
                ratio = self.RESIZE_WIDTH / img_width
                new_height = int(img_height * ratio)
                img = img.resize((self.RESIZE_WIDTH, new_height), Image.Resampling.LANCZOS)
                img_width, img_height = img.size
            
            # 转换为 base64
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=85, optimize=True)
            img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # 检查压缩后的大小
            if len(img_base64) > self.MAX_IMAGE_SIZE * 1024 * 1.4:  # base64 会增加约33%
                logger.debug(f"Compressed image still too large: {url}")
                return None
            
            return {
                'url': url,
                'base64_data': img_base64,
                'alt_text': alt_text or '',
                'width': img_width,
                'height': img_height
            }
            
        except requests.RequestException as e:
            logger.debug(f"Request error for image {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error processing image {url}: {e}")
            return None

# 全局图片提取器
_image_extractor = None

def get_image_extractor() -> ImageExtractor:
    """获取图片提取器单例"""
    global _image_extractor
    if _image_extractor is None:
        _image_extractor = ImageExtractor()
    return _image_extractor
