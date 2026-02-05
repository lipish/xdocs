#!/usr/bin/env bash
set -e

# ========================
# 基础信息
# ========================
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ========================
# 颜色定义
# ========================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}==> 开始部署 xdocs...${NC}"
echo "当前用户: $(whoami)"
echo "HOME=$HOME"

# ========================
# 强制加载 Rust 环境
# ========================
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
else
    echo -e "${RED}错误: 未找到 $HOME/.cargo/env（Rust 未安装？）${NC}"
    exit 1
fi

# ========================
# 强制加载 Node.js (nvm)
# ========================
export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
else
    echo -e "${RED}错误: 未找到 nvm.sh（Node.js 未安装？）${NC}"
    exit 1
fi

echo "PATH=$PATH"
echo "cargo: $(command -v cargo)"
echo "node : $(command -v node)"
echo "npm  : $(command -v npm)"

# ========================
# 1. 拉取代码
# ========================
echo -e "${GREEN}==> 拉取 Git 代码...${NC}"
git pull

# ========================
# 2. 构建后端 (Rust)
# ========================
echo -e "${GREEN}==> 构建后端 (Rust)...${NC}"
cd backend

if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: 未找到 backend/.env 文件${NC}"
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}错误: cargo 不存在${NC}"
    exit 1
fi

cargo build --release
cd ..

# ========================
# 3. 构建前端 (React)
# ========================
echo -e "${GREEN}==> 构建前端 (React)...${NC}"
cd frontend

if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: npm 不存在${NC}"
    exit 1
fi

npm install
npm run build
cd ..

# ========================
# 4. 重启后端服务 (PM2)
# ========================
echo -e "${GREEN}==> 重启后端服务...${NC}"

if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}错误: PM2 未安装，请执行 npm install -g pm2${NC}"
    exit 1
fi

pm2 reload xdocs-backend 2>/dev/null || \
pm2 start ./backend/target/release/xdocs-backend \
    --name xdocs-backend \
    --cwd ./backend \
    --env RUST_LOG=info

pm2 save

# ========================
# 5. 重载 Nginx
# ========================
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}==> 重载 Nginx...${NC}"
    sudo nginx -s reload
else
    echo -e "${YELLOW}提示: 未检测到 Nginx${NC}"
fi

echo -e "${GREEN}==> 部署完成 ✅${NC}"
