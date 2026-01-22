# 🎉 爬虫模块已独立！

## ✨ 新的位置

爬虫模块现在位于：**`backend/crawler/`**

这是一个完全独立的文件夹，包含所有爬虫相关的文件。

## 📁 目录结构

```
backend/
├── crawler/              ← 🕷️ 爬虫模块（独立）
│   ├── config.py
│   ├── crawler.py
│   ├── url_manager.py
│   ├── content_extractor.py
│   ├── main.py
│   ├── test_crawler.py
│   ├── example_single_page.py
│   ├── start_crawler.sh
│   ├── requirements.txt
│   ├── README.md
│   ├── OVERVIEW.md
│   ├── QUICKSTART.md
│   └── ...
├── python/               ← 🔍 搜索引擎API
│   ├── index_service.py
│   ├── search_service.py
│   └── ...
└── go/                   ← 🚀 Go API服务器
    └── ...
```

## 🚀 快速开始

### 1. 进入爬虫目录

```bash
cd /home/lancelot/verdant_search/backend/crawler
```

### 2. 安装依赖（首次运行）

```bash
pip install -r requirements.txt
```

### 3. 启动爬虫

**方法A: 使用启动脚本（推荐）**
```bash
./start_crawler.sh
```

**方法B: 直接运行**
```bash
python main.py --seeds https://www.python.org/
```

**方法C: 自定义配置**
```bash
python main.py --workers 20 --seeds https://www.python.org/ https://docs.python.org/
```

## 📊 常用命令

所有命令都在 `backend/crawler/` 目录下运行：

```bash
# 查看统计信息
python main.py --stats

# 清空爬虫数据
python main.py --clear

# 测试组件
python test_crawler.py

# 测试单个页面
python example_single_page.py https://www.python.org/
```

## ⚙️ 配置

### 环境变量

```bash
export CRAWLER_WORKERS=20      # 并发进程数
export CRAWLER_MAX_DEPTH=3     # 最大深度
export REDIS_CRAWLER_DB=1      # Redis数据库
```

### 代码配置

编辑 `config.py` 文件修改：
- User-Agent
- 请求超时
- 重试次数
- 内容长度限制
- URL过滤规则

## 🔗 与搜索引擎集成

爬虫会自动：
1. 调用 `backend/python/` 的索引服务
2. 进行分词和向量编码
3. 存储到 PostgreSQL 数据库
4. 可通过搜索引擎前端查询

**无需额外配置！**

## 📚 文档

在 `backend/crawler/` 目录下：

- 📖 **README.md** - 详细使用文档
- 📝 **OVERVIEW.md** - 项目概览
- 🚀 **QUICKSTART.md** - 快速入门
- 📋 **SUMMARY.md** - 功能总结
- 🔄 **MIGRATION.md** - 迁移说明

## ✅ 优势

1. **独立模块** - 所有爬虫文件都在一个文件夹
2. **易于管理** - 不与其他模块混在一起
3. **独立部署** - 可以单独部署爬虫服务
4. **清晰结构** - 目录结构更加清晰

## 🎯 开始使用

```bash
cd /home/lancelot/verdant_search/backend/crawler
./start_crawler.sh
```

就这么简单！🎊
