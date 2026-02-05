#!/usr/bin/env bash
set -e

# ========================
# 环境修复（非常关键）
# ========================
# CI / 非交互 shell 不会自动加载 ~/.profile
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

# ========================
# 颜色定义
# ========================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==> 开始部署 xdocs...${NC}"
echo "当前 PATH: $PATH"

# ========================
# 1. 拉取最新代码
# ========================
echo -e "${GREEN}==> 拉取 Git 代码...${NC}"
git pull

# ========================
# 2. 构建后端 (Rust)
# ========================
echo -e "${GREEN}==> 构建后端 (Rust)...${NC}"
cd backend

if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: 未找到 backend/.env 文件，请确保已正确配置环境变量。${NC}"
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}错误: 未找到 cargo。请先安装 Rust。${NC}"
    exit 1
fi

echo "使用 cargo: $(command -v cargo)"
cargo build --release

cd ..

# ========================
# 3. 构建前端 (React)
# ========================
echo -e "${GREEN}==> 构建前端 (React)...${NC}"
cd frontend

if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm。请先安装 Node.js。${NC}"
    exit 1
fi

echo "使用 npm: $(command -v npm)"

npm install
npm run build

cd ..

# ========================
# 4. 重启服务
# ========================
echo -e "${GREEN}==> 重启服务...${NC}"

# ---- PM2 后端 ----
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}错误: 未找到 PM2。请先安装: npm install -g pm2${NC}"
    exit 1
fi

echo "重启后端 (PM2)..."

# 进程存在则 reload，不存在则 start
pm2 reload xdocs-backend 2>/dev/null || \
pm2 start ./backend/target/release/xdocs-backend \
    --name xdocs-backend \
    --cwd ./backend \
    --env RUST_LOG=info

# 保存 PM2 进程（用于开机自启）
pm2 save

# ========================
# 5. 重载 Nginx
# ========================
if command -v nginx &> /dev/null; then
    echo "重载 Nginx 配置..."
    sudo nginx -s reload
else
    echo -e "${YELLOW}提示: 未检测到 Nginx。请确保 Nginx 已安装并配置。${NC}"
    echo "参考配置文件: deployment/nginx.conf"
fi

echo -e "${GREEN}==> 部署完成！${NC}"
