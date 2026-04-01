# Verdant Search Presentation - LaTeX Beamer 项目

## 📋 项目信息

**项目名称**: Verdant Search: AI Boosted Sharded Distributed Search Engine  
**作者**: CAI HONGYI (S2175463)  
**导师**: CHIAM YIN KIA  
**机构**: University of Malaya  
**文档类型**: Beamer Presentation (16:9)

---

## 🚀 快速开始

### 1️⃣ 安装 LaTeX 环境

```bash
# Manjaro/Arch Linux
sudo pacman -S texlive-core texlive-bin texlive-latexextra texlive-fontsextra texlive-bibtexextra texlive-pictures
```

### 2️⃣ 编译文档

#### 方法一：使用 Makefile（推荐）
```bash
make           # 完整编译
make view      # 编译并查看 PDF
make clean     # 清理辅助文件
```

#### 方法二：使用编译脚本
```bash
./compile.sh   # 自动完整编译
./clean.sh     # 清理辅助文件
```

#### 方法三：手动编译
```bash
pdflatex -interaction=nonstopmode sample.tex
bibtex sample
pdflatex -interaction=nonstopmode sample.tex
pdflatex -interaction=nonstopmode sample.tex
```

---

## 📂 项目结构

```
FYP_SLIDE/
├── sample.tex                    # 主文档
├── METHOD.tex                    # 方法论章节
├── reference.bib                 # 参考文献数据库
│
├── beamerthemeSimplePlus.sty     # Beamer 主题
├── beamercolorthemeSimplePlus.sty
├── beamerfontthemeSimplePlus.sty
├── beamerinnerthemeSimplePlus.sty
│
├── *.pdf / *.png                 # 图表和图片资源
│
├── compile.sh                    # 自动编译脚本
├── clean.sh                      # 清理脚本
├── Makefile                      # Make 构建文件
├── 编译说明.md                   # 详细编译说明
└── README.md                     # 本文件
```

---

## 🛠️ 可用命令汇总

| 命令 | 说明 |
|------|------|
| `make` 或 `make all` | 完整编译（pdflatex × 3 + bibtex） |
| `make quick` | 快速编译（仅一次，不处理参考文献） |
| `make clean` | 清理辅助文件 |
| `make distclean` | 完全清理（包括 PDF） |
| `make view` | 编译并打开 PDF 查看 |
| `make help` | 显示帮助信息 |
| `./compile.sh` | 使用脚本自动编译 |
| `./clean.sh` | 使用脚本清理 |

---

## 📦 依赖说明

### LaTeX 包依赖
- `beamer` - 演示文稿文档类
- `hyperref` - 超链接支持
- `graphicx` - 图片插入
- `booktabs` - 专业表格
- `amsmath, amssymb, amsfonts` - 数学符号
- `tikz` - 绘图工具
- `biblatex` - 参考文献管理

### 系统依赖
- TeX Live 核心组件
- pdfLaTeX 编译器
- BibTeX 参考文献处理器

---

## 📄 输出文件

编译成功后会生成：
- **sample.pdf** - 最终的演示文稿（主要输出）

辅助文件（可清理）：
- `*.aux` - 辅助信息
- `*.log` - 编译日志
- `*.out` - 超链接信息
- `*.toc` - 目录信息
- `*.nav, *.snm, *.vrb` - Beamer 特定文件
- `*.bbl, *.blg` - 参考文献文件

---

## ❓ 常见问题

### Q1: 编译失败，提示找不到某个包
```bash
# 安装完整的 LaTeX 发行版
sudo pacman -S texlive-most
```

### Q2: 参考文献不显示
确保执行完整编译流程：pdflatex → bibtex → pdflatex × 2

### Q3: 图片无法显示
检查图片文件是否存在，文件名是否匹配

### Q4: 如何查看编译错误
```bash
# 查看详细日志
cat sample.log | less
```

---

## 📖 详细文档

更多详细信息请参阅 `编译说明.md`

---

## 📝 编译流程说明

LaTeX Beamer 文档需要多次编译才能正确生成所有引用和参考文献：

1. **第一次 pdflatex**: 生成 .aux 文件，记录引用信息
2. **bibtex**: 处理参考文献，生成 .bbl 文件
3. **第二次 pdflatex**: 插入参考文献
4. **第三次 pdflatex**: 解析所有交叉引用，生成最终 PDF

---

## 🎨 演示文稿内容

本演示文稿包含以下章节：

1. **Introduction** - 引言和研究背景
2. **Problem Statement and Objectives** - 问题陈述和研究目标
3. **Literature Review** - 文献综述
4. **Methodology** - 研究方法论
5. **Requirements Specification** - 需求规格说明
6. **System Analysis and Design** - 系统分析与设计
7. **Technical Implementation** - 技术实现

---

## 🎨 Beamer 主题

本项目使用 **SimplePlus Beamer Theme**:
- Overleaf: https://www.overleaf.com/latex/templates/simpleplus-beamertheme/wfmfjhdcrdfx
- CTAN: https://ctan.org/pkg/beamertheme-simpleplus
- Github: https://github.com/pm25/SimplePlus-BeamerTheme

---

## 📞 支持

如有问题，请查看：
- `编译说明.md` - 详细编译指南
- `sample.log` - 编译日志文件
- Beamer 官方文档: https://ctan.org/pkg/beamer

---

**祝编译顺利！** 🎓
