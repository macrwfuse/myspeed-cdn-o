#!/usr/bin/env bash
# =============================================================================
# 一键部署：clone(或更新) myspeed-cdn-auto → 应用 CDN 自动更新补丁 → 构建并启动容器
# 用法:  bash deploy.sh [目标目录名，默认 myspeed-cn]     （在装有 Docker 的 Linux 主机上执行）
# 可选环境变量: REPO_URL=<git 地址> 覆盖仓库地址
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/macrwfuse/myspeed-cdn-auto.git}"
DIR="${1:-myspeed-cn}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$DIR/.git" ]; then
  echo "==> 目录已存在，执行 git pull 更新"
  (cd "$DIR" && git pull --ff-only)
else
  echo "==> git clone $REPO_URL → $DIR"
  git clone "$REPO_URL" "$DIR"
fi

echo "==> 应用 CDN 自动更新补丁"
bash "$HERE/apply-to-repo.sh" "$DIR"

echo "==> docker compose 构建并启动"
(cd "$DIR" && docker compose up -d --build)

echo ""
echo "✔ 部署完成。"
echo "  访问:      http://<主机IP>:5216"
echo "  看日志:    docker compose -f $DIR/docker-compose.yml logs -f myspeed"
echo "  报告文件:  $DIR/scripts/.last-report.json   （宿主机，随补丁挂载持久化）"
echo "  自动修复:  $DIR/server/controller/servers.js 的 git diff 即本次替换内容"
