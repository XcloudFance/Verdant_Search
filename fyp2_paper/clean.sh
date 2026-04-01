#!/bin/bash
# LaTeX清理脚本 - 删除编译过程中生成的辅助文件

echo "清理LaTeX辅助文件..."

cd "$(dirname "$0")"

# 删除LaTeX生成的辅助文件
rm -f *.aux *.log *.out *.toc *.nav *.snm *.vrb
rm -f *.bbl *.blg *.bcf *.run.xml
rm -f *.fls *.fdb_latexmk *.synctex.gz

echo "清理完成！"
echo "保留的文件: .tex, .pdf, .bib, .sty 等源文件"


