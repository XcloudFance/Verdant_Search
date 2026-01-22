# 完整多模态搜索系统实现计划

## 功能概览

1. **网页图片提取** - 爬虫从网页提取图片并存储
2. **搜索结果图片显示** - 在搜索结果中显示网页的图片
3. **LLM 多模态对话** - Chatbot 可以"看到"搜索结果中的图片
4. **以图搜图** - 用户上传图片进行相似图片搜索 ⭐ 新增

---

## ✅ 已完成部分

### 1. 数据库 Schema 修改
- **文件**: `backend/python/models.py`
- **修改**: `Document` 表添加 `images` JSON 字段
- **格式**: `[{url, base64_data, alt_text, width, height}]` - 最多4张图片
- **状态**: ✅ 完成并重新创建数据库

### 2. 图片提取器
- **文件**: `backend/crawler/image_extractor.py` (新建)
- **功能**:
  - 从 HTML 提取图片
  - 下载验证（最小 200x200px）
  - 压缩优化（最大宽度 800px）
  - Base64 编码存储
  - 最多提取4张图片
- **状态**: ✅ 完成

### 3. 爬虫集成
- **文件**: `backend/crawler/crawler.py`
- **修改**: 
  - `index_document()` 添加 `images` 参数
  - `process_url()` 调用 ImageExtractor
  - 传递图片数据到索引服务
- **状态**: ✅ 完成

### 4. 索引服务
- **文件**: `backend/python/index_service.py`
- **修改**: `index_document()` 接受并保存 `images` 数据
- **状态**: ✅ 完成

### 5. 依赖更新
- **文件**: `backend/crawler/requirements.txt`
- **新增**: `requests`, `Pillow`, `beautifulsoup4`
- **状态**: ✅ 完成

---

## 🚧 待完成 - Phase 1: 基础图片功能

### 1. 搜索 API 修改
**文件**: `backend/python/search_service.py`

**任务**:
- 在 `hybrid_search()` 返回值中包含 `images` 字段
- 对于每个搜索结果，从数据库加载图片数据

**示例返回格式**:
```python
{
    "id": 123,
    "title": "...",
    "content": "...",
    "url": "...",
    "images": [
        {
            "url": "https://...",
            "base64_data": "iVBORw0K...",
            "alt_text": "...",
            "width": 800,
            "height": 600
        }
    ],
    "score": 0.95
}
```

### 2. 前端搜索结果显示
**文件**: `frontend/src/components/SearchResults.jsx` (或类似)

**任务**:
- 接收 API 返回的images 数据
- 实现响应式图片网格布局：
  - 1张图：单张大图
  - 2张图：左右并排
  - 3-4张图：2x2网格
  - \>4张：只显示前4张
- 实现图片预览/放大功能（Modal）
- 悬浮显示 alt_text

**UI 设计**:
```jsx
<SearchResultCard>
  <Title>文档标题</Title>
  <ContentPreview>内容摘要...</ContentPreview>
  {images.length > 0 && (
    <ImageGrid count={images.length}>
      {images.map(img => (
        <ImageThumbnail 
          src={`data:image/jpeg;base64,${img.base64_data}`}
          alt={img.alt_text}
          onClick={() => openPreview(img)}
        />
      ))}
    </ImageGrid>
  )}
</SearchResultCard>
```

### 3. LLM Chatbot 后端修改
**文件**: `backend/python/llm_service.py`

**任务**:
- 修改 `chat()` 方法接受 `document_ids` 而非完整文档
- 从数据库查询 `document_ids` 对应的文档和图片
- 将图片 base64 数据传递给 Claude API (vision 模型)

**API 调用示例**:
```python
messages = [{
    "role": "user",
    "content": [
        {"type": "text", "text": user_query},
        # 添加图片
        *[{
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": img["base64_data"]
            }
        } for doc in documents for img in doc.get("images", [])[:2]]  # 每个文档最多2张
    ]
}]
```

### 4. 前端 Chatbot 修改
**文件**: `frontend/src/components/ChatWidget.jsx` (或类似)

**任务**:
- 修改 API 调用，传递 `document_ids` 而非完整内容
- 示例：`{ query, document_ids: [1, 2, 3] }`
- 后端会自动从数据库获取图片数据

---

## 🚧 待完成 - Phase 2: 以图搜图功能 ⭐

### 1. 图片 Embedding 服务
**文件**: `backend/python/embedding_service.py`

**任务**:
- 现有的 CLIP 模型已支持图片编码
- 添加 `encode_image_from_base64()` 方法
- 添加 `encode_image_from_file()` 方法

```python
def encode_image_from_base64(self, base64_data: str) -> np.ndarray:
    """从 base64 编码图片生成 embedding"""
    image_data = base64.b64decode(base64_data)
    image = Image.open(BytesIO(image_data))
    return self.model.encode(image)
```

### 2. 图片搜索 API
**文件**: `backend/python/api/search.py` (新endpoint)

**新增端点**: `POST /api/search/image`

**请求格式**:
```json
{
    "image": "base64_encoded_image_data",
    "top_k": 10
}
```

**实现逻辑**:
1. 接收 base64 图片
2. 使用 CLIP 生成图片 embedding
3. 在 `document_embeddings` 表中进行向量相似度搜索
4. 返回最相关的文档（包含图片）

**SQL 查询**:
```sql
SELECT d.*, de.embedding <=> :query_embedding AS distance
FROM documents d
JOIN document_embeddings de ON d.id = de.document_id
WHERE d.images IS NOT NULL  -- 只返回有图片的文档
ORDER BY de.embedding <=> :query_embedding
LIMIT :top_k
```

### 3. 前端图片上传组件
**文件**: `frontend/src/components/ImageUpload.jsx` (新建)

**功能**:
- 文件选择器或拖拽上传
- 图片预览
- 转换为 base64
- 调用图片搜索 API

**UI 设计**:
```jsx
<ImageSearchWidget>
  <UploadArea onDrop={handleDrop}>
    {previewImage ? (
      <ImagePreview src={previewImage} />
    ) : (
      <UploadPrompt>
        点击或拖拽图片到这里<br/>
        支持 JPG, PNG, GIF
      </UploadPrompt>
    )}
  </UploadArea>
  <SearchButton onClick={() => searchByImage(base64Image)}>
    以图搜图
  </SearchButton>
</ImageSearchWidget>
```

### 4. 搜索页面集成
**文件**: `frontend/src/pages/SearchPage.jsx`

**任务**:
- 在搜索栏旁边添加图片上传按钮
- 点击切换到图片搜索模式
- 显示图片搜索结果（复用现有 SearchResults 组件）

```jsx
<SearchBar>
  <TextInput value={query} onChange={setQuery} />
  <ImageUploadButton onClick={toggleImageSearch} />
  <SearchButton onClick={handleSearch} />
</SearchBar>

{showImageUpload && (
  <ImageUpload onImageSearch={handleImageSearch} />
)}
```

---

## 📋 实现顺序建议

### 第一轮 - 立即可做（不影响爬虫）:
1. ✅ 数据库 Schema 修改 (已完成)
2. ✅ 爬虫图片提取 (已完成)  
3. ✅ 图片存储到数据库 (已完成)
4. 🔄 **安装依赖并重启爬虫** (进行中)

### 第二轮 - 后端 API 开发:
1. 修改搜索服务返回图片
2. 修改 LLM 服务支持图片输入
3. 实现图片搜索 API

### 第三轮 - 前端开发:
1. 搜索结果显示图片
2. Chatbot 传递 document_ids
3. 图片上传组件
4. 以图搜图功能集成

---

## 🔧 技术方案细节

### 图片相似度搜索原理
1. **CLIP 模型**: 将文本和图片映射到同一向量空间
2. **图片 Embedding**: 512维向量
3. **相似度计算**: 余弦相似度 (pgvector `<=>` 操作符)
4. **混合搜索**: 可以结合文本查询和图片查询

### 性能优化
- **Base64 大小限制**: 单图最大 500KB 压缩后
- **向量索引**: pgvector IVFFlat 索引加速搜索
- **图片懒加载**: 前端只在可视区域加载图片
- **缩略图**: 搜索结果显示小图，点击查看大图

### 安全考虑
- **文件类型验证**: 只接受图片格式
- **大小限制**: 上传图片 < 5MB
- **内容验证**: PIL 打开验证是否为有效图片
- **XSS 防护**: Base64 数据不包含可执行代码

---

## ⚡ 立即行动

### 1. 安装爬虫依赖
```bash
cd /home/lancelot/verdant_search/backend/crawler
pip install -r requirements.txt
```

### 2. 重新启动爬虫
```bash
bash start_crawler.sh https://docs.oracle.com/en/java/javase/17/docs/api/index.html
```

### 3. 观察图片提取
查看日志中的 "Extracted X images from ..." 信息

---

## 📊 预期效果

### 文本搜索 + 图片展示
- 用户搜索 "Java String"
- 返回相关文档 + 该文档中的图片（类图、示例截图等）
- Chatbot 可以基于图片回答问题："这个类图显示了什么？"

### 以图搜图
- 用户上传一张架构图
- 系统返回包含相似架构图的文档
- 结合文本搜索："查找和这个架构类似的设计模式"

### LLM 多模态对话
- 用户："解释一下这个 UML 图"
- LLM 看到搜索结果中的 UML 图片
- LLM 详细解释图中的类关系

---

## 🎯 成功指标

- ✅ 爬虫成功提取并存储图片
- ✅ 搜索结果正确显示图片
- ✅ 图片预览功能流畅
- ✅ LLM 能理解并描述图片内容
- ✅ 以图搜图准确率 > 80%
- ✅ 单次图片搜索 < 2秒

---

**当前状态**: Phase 1 基础设施已完成，等待安装依赖并开始爬取数据。

**下一步**: 安装爬虫依赖 → 重启爬虫 → 验证图片提取 → 开发搜索API  
