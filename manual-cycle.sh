#!/usr/bin/env bash
# =============================================================================
# 手动触发一轮 CDN 自动更新（无需重启容器）
# 用法: bash manual-cycle.sh            （默认容器名 myspeed-cn）
#       CONTAINER=xxx bash manual-cycle.sh
# =============================================================================
set -euo pipefail

CONTAINER="${CONTAINER:-myspeed-cn}"

echo "==> 手动执行 CDN 互联网发现 (cdn-discovery.mjs)"
docker exec "$CONTAINER" sh -lc 'cd /myspeed && bun run scripts/cdn-discovery.mjs --json | head -c 4000; echo'

echo ""
echo "==> 手动执行 CDN 探活+失效替换 (update-cdn-nodes.mjs)"
docker exec "$CONTAINER" sh -lc 'cd /myspeed && bun run scripts/update-cdn-nodes.mjs --verbose'

echo ""
echo "==> 若上方 replaced > 0，重启 server 进程使新节点生效："
echo "    docker restart $CONTAINER"
echo "    或 查看报告: cat scripts/.last-report.json"
