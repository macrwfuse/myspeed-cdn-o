#!/usr/bin/env bash
# =============================================================================
# 把 CDN 自动更新补丁应用到已克隆的 myspeed-cdn-auto 仓库目录
# 用法:  bash apply-to-repo.sh /path/to/myspeed-cdn-auto
# 执行后再进仓库目录: docker compose up -d --build
# =============================================================================
set -euo pipefail

TARGET="${1:?用法: bash apply-to-repo.sh /path/to/myspeed-cdn-auto (仓库根目录)}"
if [ ! -f "$TARGET/package.json" ] || [ ! -f "$TARGET/Dockerfile" ]; then
  echo "错误: $TARGET 看起来不是 myspeed-cdn-auto 仓库根目录（缺少 package.json/Dockerfile）" >&2
  exit 1
fi

# 1) 覆盖 Dockerfile / docker-compose.yml
cp -f "$(dirname "$0")/Dockerfile"          "$TARGET/Dockerfile"
cp -f "$(dirname "$0")/docker-compose.yml"  "$TARGET/docker-compose.yml"

# 2) 新增 docker/ 监督调度器
mkdir -p "$TARGET/docker" "$TARGET/logs"
cp -f "$(dirname "$0")/docker/cdn-scheduler.mjs" "$TARGET/docker/cdn-scheduler.mjs"

echo "✔ 补丁已应用: $TARGET"
echo "  下一步: cd $TARGET && docker compose up -d --build"
