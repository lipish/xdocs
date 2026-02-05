#!/bin/bash
set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==> 开始部署 xdocs...${NC}"

# 1. 拉取最新代码
echo -e "${GREEN}==> 拉取 Git 代码...${NC}"
git pull

# 2. 检查并构建后端
echo -e "${GREEN}==> 构建后端 (Rust)...${NC}"
cd backend
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: 未找到 .env 文件，请确保已正确配置环境变量。${NC}"
fi

if ! command -v cargo &> /dev/null; then
    echo "错误: 未找到 cargo。请先安装 Rust。"
    exit 1
fi

cargo build --release
cd ..

# 3. 检查并构建前端
echo -e "${GREEN}==> 构建前端 (React)...${NC}"
cd frontend
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm。请先安装 Node.js。"
    exit 1
fi

npm install
npm run build
cd ..

# 4. 重启服务
echo -e "${GREEN}==> 重启服务...${NC}"

# 使用 PM2 管理后端 (无需配置文件)
echo "重启后端 (PM2)..."
if ! command -v pm2 &> /dev/null; then
    echo "错误: 未找到 PM2。请先安装: npm install -g pm2"
    exit 1
fi

# 尝试重载，如果失败（进程不存在）则启动
# --cwd 指定工作目录，确保能找到 .env
# --name 指定进程名称
pm2 reload xdocs-backend 2>/dev/null || \
pm2 start ./backend/target/release/xdocs-backend \
    --name xdocs-backend \
    --cwd ./backend \
    --env RUST_LOG=info

# 保存当前进程列表，以便开机自启
pm2 save

# 检查 Nginx
if command -v nginx &> /dev/null; then
    echo "重载 Nginx 配置..."
    sudo nginx -s reload
else
    echo -e "${YELLOW}提示: 未检测到 Nginx。请确保 Nginx 已安装并配置。${NC}"
    echo "参考配置文件: deployment/nginx.conf"
fi

echo -e "${GREEN}==> 部署完成！${NC}"
