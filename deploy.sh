#!/usr/bin/env bash
set -e

# =========================================================
# 0. 保证在 bash 下执行（防止 appleboy 用 sh）
# =========================================================
if [ -z "$BASH_VERSION" ]; then
  exec /usr/bin/env bash "$0" "$@"
fi

# =========================================================
# 1. 强制 HOME & PATH（CI 必须）
# =========================================================
export HOME=/home/ubuntu
export PATH="$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# =========================================================
# 2. 强制加载 Rust 环境（CI 必须）
# =========================================================
if [ -f "$HOME/.cargo/env" ]; then
  source "$HOME/.cargo/env"
else
  echo "❌ 错误: 未找到 $HOME/.cargo/env（Rust 未安装？）"
  exit 1
fi

# =========================================================
# 3. 基础环境自检（关键）
# =========================================================
echo "========== 环境检查 =========="
echo "SHELL=$SHELL"
echo "BASH_VERSION=$BASH_VERSION"
echo "HOME=$HOME"
echo "PATH=$PATH"

if ! command -v cargo >/dev/null 2>&1; then
  echo "❌ 错误: cargo 不在 PATH 中"
  exit 1
fi
echo "✅ cargo: $(command -v cargo)"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 错误: npm 不在 PATH 中"
  exit 1
fi
echo "✅ npm: $(command -v npm)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ 错误: pm2 不在 PATH 中"
  exit 1
fi
echo "✅ pm2: $(command -v pm2)"

echo "=============================="

# =========================================================
# 颜色定义
# =========================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}==> 开始部署 xdocs...${NC}"

# =========================================================
# 4. 拉取代码
# =========================================================
echo -e "${GREEN}==> 拉取 Git 代码...${NC}"
git pull

# =========================================================
# 5. 构建后端 (Rust)
# =========================================================
echo -e "${GREEN}==> 构建后端 (Rust)...${NC}"
cd backend

if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️ 警告: 未找到 backend/.env 文件${NC}"
fi

cargo build --release

cd ..

# =========================================================
# 6. 构建前端 (React)
# =========================================================
echo -e "${GREEN}==> 构建前端 (React)...${NC}"
cd frontend

npm install
npm run build

cd ..

# =========================================================
# 7. 启动 / 重启后端服务（PM2）
# =========================================================
echo -e "${GREEN}==> 重启后端服务 (PM2)...${NC}"

pm2 reload xdocs-backend 2>/dev/null || \
pm2 start ./backend/target/release/xdocs-backend \
  --name xdocs-backend \
  --cwd ./backend \
  --env RUST_LOG=info

pm2 save

# =========================================================
# 8. 重载 Nginx
# =========================================================
if command -v nginx >/dev/null 2>&1; then
  echo -e "${GREEN}==> 重载 Nginx 配置...${NC}"
  sudo nginx -s reload
else
  echo -e "${YELLOW}⚠️ 未检测到 Nginx${NC}"
fi

echo -e "${GREEN}==> 🎉 部署完成！${NC}"
