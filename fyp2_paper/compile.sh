#!/bin/bash

# LaTeX编译脚本 - 完整版
# 用于编译 main.tex 及其所有依赖

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 主文件名（不含扩展名）
MAIN_FILE="sample"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}开始编译 LaTeX 文档${NC}"
echo -e "${GREEN}================================${NC}"

# 检查必要的工具
echo -e "${YELLOW}检查编译工具...${NC}"
command -v pdflatex >/dev/null 2>&1 || { echo -e "${RED}错误: 未找到 pdflatex，请安装 texlive${NC}" >&2; exit 1; }
command -v bibtex >/dev/null 2>&1 || { echo -e "${RED}错误: 未找到 bibtex，请安装 texlive${NC}" >&2; exit 1; }

# 检查主文件是否存在
if [ ! -f "${MAIN_FILE}.tex" ]; then
    echo -e "${RED}错误: 未找到 ${MAIN_FILE}.tex${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 编译环境检查完成${NC}"
echo ""

# 第一次编译 - 生成辅助文件和目录
echo -e "${YELLOW}[1/4] 第一次编译 pdflatex (生成辅助文件)...${NC}"
pdflatex -interaction=nonstopmode -halt-on-error "${MAIN_FILE}.tex" || {
    echo -e "${RED}第一次 pdflatex 编译失败！${NC}"
    exit 1
}

# 编译参考文献
echo -e "${YELLOW}[2/4] 编译参考文献 (bibtex)...${NC}"
if grep -q '\\citation' "${MAIN_FILE}.aux" 2>/dev/null; then
    bibtex "${MAIN_FILE}" || {
        echo -e "${RED}bibtex 编译失败！${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}文档无引用，跳过 bibtex${NC}"
fi

# 第二次编译 - 更新引用
echo -e "${YELLOW}[3/4] 第二次编译 pdflatex (更新引用)...${NC}"
pdflatex -interaction=nonstopmode -halt-on-error "${MAIN_FILE}.tex" || {
    echo -e "${RED}第二次 pdflatex 编译失败！${NC}"
    exit 1
}

# 第三次编译 - 确保所有引用正确
echo -e "${YELLOW}[4/4] 第三次编译 pdflatex (完成所有引用)...${NC}"
pdflatex -interaction=nonstopmode -halt-on-error "${MAIN_FILE}.tex" || {
    echo -e "${RED}第三次 pdflatex 编译失败！${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}编译完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}输出文件: ${MAIN_FILE}.pdf${NC}"

# 显示文件大小
if [ -f "${MAIN_FILE}.pdf" ]; then
    FILE_SIZE=$(du -h "${MAIN_FILE}.pdf" | cut -f1)
    echo -e "${GREEN}文件大小: ${FILE_SIZE}${NC}"
fi

# 询问是否清理临时文件
echo ""
read -p "是否清理临时文件？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}清理临时文件...${NC}"
    rm -f *.aux *.log *.out *.toc *.lof *.lot *.bbl *.blg *.nav *.snm *.vrb
    echo -e "${GREEN}✓ 清理完成${NC}"
fi

echo -e "${GREEN}全部完成！${NC}"
