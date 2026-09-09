# syntax=docker/dockerfile:1
#
# MySpeed-CN + CDN 节点自动更新 (myspeed-cdn-auto)
# -----------------------------------------------------------
# 相对上游修改点（用 `[CDN-AUTO]` 标注）：
#   1. 最终镜像补 COPY ./scripts（cdn-discovery.mjs / update-cdn-nodes.mjs 上游漏拷）
#   2. 最终镜像新增 ./docker/cdn-scheduler.mjs（监督调度器）
#   3. 默认 CMD 改为监督调度器：容器启动/重启自动执行一轮 CDN 发现+更新，
#      定时(默认每天 03:17)执行，替换失效链接后自动重启 server 进程加载新节点。
#      CDN_SERVER_ONLY=true 可还原为"仅运行 server"的原版行为。

# ─────────────────────────────────────────────
# 阶段 1：构建前端 (client)
# ─────────────────────────────────────────────
FROM docker.1ms.run/node:20-slim AS client-build

WORKDIR /client
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list.d/debian.sources; \
    else \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list; \
    fi

COPY ./client/package.json ./
RUN npm install
COPY ./client ./
RUN npm run build

# ─────────────────────────────────────────────
# 阶段 2：安装服务端依赖并生成迁移/集成/内嵌前端
# ─────────────────────────────────────────────
FROM docker.1ms.run/oven/bun:1 AS server-build

WORKDIR /myspeed

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list.d/debian.sources; \
    else \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list; \
    fi

COPY ./server /myspeed/server
COPY ./scripts /myspeed/scripts
COPY ./package.json /myspeed/package.json

RUN bun install
RUN bun run generate-migrations
RUN bun run generate-integrations

# Embed client assets into server for standalone mode
COPY --from=client-build /client/build /myspeed/build
RUN bun run generate-client-embed

# ─────────────────────────────────────────────
# 阶段 3：下载测速 CLI 二进制 (linux x86_64)
# ─────────────────────────────────────────────
FROM docker.1ms.run/debian:bookworm-slim AS binaries

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list.d/debian.sources; \
    else \
      sed -i \
        -e 's|deb.debian.org|mirrors.aliyun.com|g' \
        -e 's|security.debian.org|mirrors.aliyun.com/debian-security|g' \
        /etc/apt/sources.list; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates tar gzip unzip && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /bins

# Ookla Speedtest CLI v1.2.0
RUN curl -fsSL "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz" -o /tmp/ookla.tgz && \
    tar -xzf /tmp/ookla.tgz -C /bins speedtest && \
    chmod +x /bins/speedtest && \
    rm /tmp/ookla.tgz

# LibreSpeed CLI v1.0.10
RUN curl -fsSL "https://gh.xxooo.cf/https://github.com/librespeed/speedtest-cli/releases/download/v1.0.10/librespeed-cli_1.0.10_linux_amd64.tar.gz" -o /tmp/libre.tar.gz && \
    tar -xzf /tmp/libre.tar.gz -C /bins librespeed-cli && \
    chmod +x /bins/librespeed-cli && \
    rm /tmp/libre.tar.gz

# Cloudflare cfspeedtest v2.2.2
RUN curl -fsSL "https://gh.xxooo.cf/https://github.com/code-inflation/cfspeedtest/releases/download/v2.2.2/cfspeedtest-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/cf.tar.gz && \
    tar -xzf /tmp/cf.tar.gz -C /bins cfspeedtest && \
    chmod +x /bins/cfspeedtest && \
    rm /tmp/cf.tar.gz

# ─────────────────────────────────────────────
# 阶段 4：最终镜像
# ─────────────────────────────────────────────
FROM docker.1ms.run/oven/bun:1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates openssl curl \
    && rm -rf /var/lib/apt/lists/*

# 默认时区设为 Asia/Shanghai
ENV TZ=Asia/Shanghai

WORKDIR /myspeed

COPY --from=server-build /myspeed/server /myspeed/server
COPY --from=server-build /myspeed/package.json /myspeed/package.json
COPY --from=server-build /myspeed/node_modules /myspeed/node_modules
COPY --from=client-build /client/build /myspeed/build

# Copy pre-downloaded speed test binaries
COPY --from=binaries /bins/speedtest /myspeed/bin/speedtest
COPY --from=binaries /bins/librespeed-cli /myspeed/bin/librespeed-cli
COPY --from=binaries /bins/cfspeedtest /myspeed/bin/cfspeedtest

# [CDN-AUTO] 把 CDN 发现/更新脚本与监督调度器放入最终镜像（上游只拷进 server-build，未进最终镜像）
COPY ./scripts /myspeed/scripts
COPY ./docker /myspeed/docker
RUN mkdir -p /myspeed/logs

VOLUME ["/myspeed/data"]

EXPOSE 5216

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5216/api/info/version || exit 1

# [CDN-AUTO] 默认入口：监督调度器（启动即拉起 server，并按 cron 执行 CDN 发现+更新，
#           替换后自动重启 server）。设 CDN_SERVER_ONLY=true 可还原：bun run server/index.js
CMD ["bun", "run", "docker/cdn-scheduler.mjs"]
