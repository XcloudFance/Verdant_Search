# Makefile for LaTeX Beamer Presentation
# 项目: Verdant Search Presentation

# 主文档名称（不含扩展名）
TARGET = sample

# LaTeX 编译器
LATEX = pdflatex
BIBTEX = bibtex

# 编译选项
LATEX_FLAGS = -interaction=nonstopmode -file-line-error

# 默认目标
.PHONY: all
all: $(TARGET).pdf
	@echo "========================================="
	@echo "编译完成！输出文件: $(TARGET).pdf"
	@echo "========================================="

# 完整编译流程
$(TARGET).pdf: $(TARGET).tex METHOD.tex reference.bib
	@echo "[1/4] 第一次 pdflatex 编译..."
	$(LATEX) $(LATEX_FLAGS) $(TARGET).tex
	@echo "[2/4] 处理参考文献..."
	$(BIBTEX) $(TARGET)
	@echo "[3/4] 第二次 pdflatex 编译..."
	$(LATEX) $(LATEX_FLAGS) $(TARGET).tex
	@echo "[4/4] 第三次 pdflatex 编译..."
	$(LATEX) $(LATEX_FLAGS) $(TARGET).tex

# 快速编译（仅一次，不处理参考文献）
.PHONY: quick
quick:
	@echo "快速编译..."
	$(LATEX) $(LATEX_FLAGS) $(TARGET).tex

# 清理辅助文件
.PHONY: clean
clean:
	@echo "清理辅助文件..."
	rm -f *.aux *.log *.out *.toc *.nav *.snm *.vrb
	rm -f *.bbl *.blg *.bcf *.run.xml
	rm -f *.fls *.fdb_latexmk *.synctex.gz
	@echo "清理完成！"

# 完全清理（包括 PDF）
.PHONY: distclean
distclean: clean
	@echo "删除生成的 PDF..."
	rm -f $(TARGET).pdf
	@echo "完全清理完成！"

# 查看 PDF
.PHONY: view
view: $(TARGET).pdf
	@echo "打开 PDF 文件..."
	xdg-open $(TARGET).pdf || evince $(TARGET).pdf || okular $(TARGET).pdf

# 显示帮助信息
.PHONY: help
help:
	@echo "LaTeX Beamer 编译系统"
	@echo "===================="
	@echo ""
	@echo "可用命令："
	@echo "  make           - 完整编译（默认）"
	@echo "  make all       - 完整编译"
	@echo "  make quick     - 快速编译（仅一次，不处理参考文献）"
	@echo "  make clean     - 清理辅助文件"
	@echo "  make distclean - 完全清理（包括 PDF）"
	@echo "  make view      - 编译并查看 PDF"
	@echo "  make help      - 显示此帮助信息"
	@echo ""
	@echo "示例："
	@echo "  make           # 编译文档"
	@echo "  make view      # 编译并打开 PDF"
	@echo "  make clean     # 清理临时文件"


