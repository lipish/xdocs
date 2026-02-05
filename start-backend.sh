#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/backend"

export DATABASE_URL=postgresql://xinference@localhost:5432/xdocs
export JWT_SECRET=xdocs-secret
export BIND_ADDR=127.0.0.1:8752
export STORAGE_ROOT=./data/documents
export DEFAULT_ADMIN_EMAIL=admin@xinference.local
export DEFAULT_ADMIN_USERNAME=admin
export DEFAULT_ADMIN_PASSWORD=admin123

echo "Starting backend at http://${BIND_ADDR} ..."
cargo run
