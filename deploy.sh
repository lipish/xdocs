#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# xdocs deploy script
# 适用场景：
# - appleboy/ssh-action
# - GitHub Actions
# - 手动 ssh 执行
# ============================================================

# ========================
# 颜色定义
# ========================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "========== 环境检查 =========="
echo "SHELL=$SHELL"
echo "BASH_VERSION=$BASH_VERSION"
echo "HOME=$HOME"
echo "PATH=$PATH"
echo "================================"

# ============================================================
# 1. 强制加载 Rust (cargo)
# ============================================================
echo -e "${GREEN}==> 初始化 Rust 环境...${NC}"

if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck disable=SC1090
    source "$HOME/.cargo/env"
else
    echo -e "${RED}❌ 错误: 未找到 $HOME/.cargo/env（Rust 未安装）${NC}"
    exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: cargo 不在 PATH 中${NC}"
    echo "PATH=$PATH"
    exit 1
fi

echo -e "✅ cargo: $(command -v cargo)"

# ============================================================
# 2. 强制加载 Node.js (nvm)
# ============================================================
echo -e "${GREEN}==> 初始化 Node.js 环境...${NC}"

# 尝试加载 nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    source "$NVM_DIR/nvm.sh"
    echo "✅ 已加载 nvm"
elif [ -s "/usr/local/share/nvm/nvm.sh" ]; then
    # GitHub Actions 可能的位置
    source "/usr/local/share/nvm/nvm.sh"
    echo "✅ 已加载 nvm (System)"
fi

# 如果加载了 nvm，尝试切换到 LTS 或 default
if command -v nvm >/dev/null 2>&1; then
    nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
fi

# 检查 npm 是否可用
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ npm 未在 PATH 中找到，尝试手动添加常见路径...${NC}"
    
    # 尝试添加用户级 bin
    export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
    
    # 尝试查找并添加 Node 路径 (硬编码备选)
    POSSIBLE_NODE_DIRS=(
        "$HOME/.nvm/versions/node/v*/bin"
        "/usr/local/bin"
        "/usr/bin"
    )
    
    for dir_pattern in "${POSSIBLE_NODE_DIRS[@]}"; do
        # 展开通配符
        for dir in $dir_pattern; do
            if [ -d "$dir" ] && [ -x "$dir/npm" ]; then
                echo "✅ 发现 npm: $dir"
                export PATH="$dir:$PATH"
                break 2
            fi
        done
    done
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: npm 仍然未找到。请确认 Node.js 已安装并配置正确。${NC}"
    echo "当前 PATH: $PATH"
    exit 1
fi

echo -e "✅ node: $(node -v) ($(command -v node))"
echo -e "✅ npm: $(npm -v) ($(command -v npm))"

# (Clean up duplicate check)

# ============================================================
# 3. 拉取最新代码
# ============================================================
echo -e "${GREEN}==> 拉取 Git 代码...${NC}"
git pull

# ============================================================
# 4. 构建后端 (Rust)
# ============================================================
echo -e "${GREEN}==> 构建后端 (Rust)...${NC}"
cd backend

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️ 警告: backend/.env 不存在${NC}"
fi

cargo build --release

cd ..

# ============================================================
# 5. 构建前端 (React)
# ============================================================
echo -e "${GREEN}==> 构建前端 (React)...${NC}"
cd frontend

npm install
npm run build

cd ..

# ============================================================
# 6. 重启后端服务 (PM2)
# ============================================================
echo -e "${GREEN}==> 重启后端服务 (PM2)...${NC}"

if ! command -v pm2 >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: PM2 未安装${NC}"
    echo "请执行: npm install -g pm2"
    exit 1
fi

pm2 reload xdocs-backend 2>/dev/null || \
pm2 start ./backend/target/release/xdocs-backend \
    --name xdocs-backend \
    --cwd ./backend \
    --env RUST_LOG=info

pm2 save

# ============================================================
# 7. 重载 Nginx
# ============================================================
echo -e "${GREEN}==> 重载 Nginx...${NC}"

if command -v nginx >/dev/null 2>&1; then
    sudo nginx -s reload
else
    echo -e "${YELLOW}⚠️ 未检测到 nginx，已跳过${NC}"
fi

echo -e "${GREEN}🎉 xdocs 部署完成！${NC}"
