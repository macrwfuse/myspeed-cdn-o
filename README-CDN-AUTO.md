# myspeed-cdn-auto · 容器内 CDN 节点自动更新落地包

> 分析对象：<https://github.com/macrwfuse/myspeed-cdn-auto>（`main` 分支，仓库描述：*MySpeed-CN CDN 节点自动更新工具 - 自动检测失效链接并从互联网拉取替代*）
>
> 本目录是**可直接部署的补丁包**：把 `Dockerfile`、`docker-compose.yml`、`docker/cdn-scheduler.mjs` 覆盖/新增到仓库克隆目录后，`docker compose up -d --build` 即可得到满足下列目标的容器：
>
> - 在容器内**定时**自动运行「CDN 节点互联网发现脚本」与「节点更新脚本」；
> - 自动触发 CDN 链接**有效性检查**，**发现失效自动替换**；
> - **容器启动 / 重启自动触发**一轮；替换发生后自动重启 server 进程使新节点立即生效。

---

## 一、项目机制分析（先弄清它现在能做什么、缺什么）

### 1. 代码结构（与自动化相关的部分）

| 文件 | 作用 |
|---|---|
| `scripts/cdn-discovery.mjs` | CDN 链接**互联网发现**：聚合 5 类来源（GitHub 维护的 URL 列表 / 大厂 APP 下载端点 / 字节系 CDN 多边缘变体扫描 / 运营商 CDN / APP 更新接口），去重后输出候选链接。可独立运行：`node scripts/cdn-discovery.mjs [--json]`，也可被 `update-cdn-nodes.mjs` import 调用。 |
| `scripts/update-cdn-nodes.mjs` | 核心**更新脚本**：① 解析 `server/controller/servers.js` 中 `export const CDN_SERVERS` 全部下载链接；② 并发 6、15s 超时、HEAD→GET(`Range: bytes=0-0`) 兜底地**探活**；③ 把存活链接 + 内置静态源 + **互联网发现结果**汇入备用池 `scripts/.cdn-backup-pool.json`，并对池内链接做可用性验证；④ 对失效链接按 **CDN 分组**（和彩云/天翼云/Speedo云/360云/腾讯云）从池中挑选**同组替代**（优先异域名、未被其他节点使用）；⑤ 改写 `servers.js`，写报告 `scripts/.last-report.json`。支持 `--check-only` / `--verbose`；有失效且未能全部替换时以 exit 1 结束。 |
| `server/controller/servers.js` | 三类内嵌节点：`OOKLA_CN_SERVERS`、`LIBRE_CN_SERVERS`、**`CDN_SERVERS`**（更新脚本直接改写的目标）。`getCdnServers()` 合并 `data/servers/cdn.json` 与内嵌列表，**模块级变量缓存**结果。 |
| `Dockerfile` / `docker-compose.yml` | 上游的多阶段镜像（client-build → server-build → binaries → 最终镜像）。最终镜像 `CMD ["bun","run","server/index.js"]`。 |
| `server/index.js` | MySpeed 服务入口；支持 `RUN_TEST_ON_STARTUP=true` 启动即测速；定时任务由 `server/tasks/timer.js` 用 `node-schedule` 按配置的 cron 触发。 |

### 2. 关键结论（改造依据）

1. **脚本本身已实现「失效自动替换」闭环**，但作者只给了宿主机 crontab 建议（脚本头注释：`0 3 * * * cd /path && node scripts/update-cdn-nodes.mjs`），**仓库未提供任何容器内调度/启动钩子**：Dockerfile 无 cron、无 entrypoint，compose 也只有可选的 `RUN_TEST_ON_STARTUP`。
2. **上游最终镜像根本没把 `scripts/` 复制进去**（`scripts/` 只 COPY 进了 server-build 阶段），因此**现成镜像里无法运行这两个脚本**——必须改 Dockerfile。
3. `servers.js` 是**静态 import + 模块级缓存**（`getCdnServers()` 首调后缓存），所以脚本改写文件后，**正在运行的 server 进程不会加载新节点**，必须重启进程；若容器是 `docker compose up` 重建的（非仅 `docker restart`），未挂载的修改还会丢失。
4. 因此“单容器内完成 定时 + 发现 + 更新 + 替换 + 重启自动触发 + 替换后生效”需要：**① 修改 Dockerfile（补拷 scripts/，新增监督调度器入口）；② 容器内自建调度与监督；③ 把被改写的 `servers.js` 与脚本状态目录绑定挂载持久化。**

---

## 二、本补丁包的设计

### 1. 架构：单容器「监督调度器」模型

```
                    ┌──────────────────────── 容器 (myspeed-cn) ────────────────────────┐
                    │  PID1: docker/cdn-scheduler.mjs  (bun)                            │
                    │    │                                                              │
                    │    ├─ 启动时拉起并监督 ──▶ 子进程: bun run server/index.js        │
                    │    │                        （崩溃自动重拉 / 收到信号优雅退出）      │
                    │    ├─ 容器启动/重启 → 延迟 CDN_UPDATE_START_DELAY_SEC=60s 后       │
                    │    │    执行一轮:  cdn-discovery.mjs → update-cdn-nodes.mjs       │
                    │    │                                                              │
                    │    ├─ cron 定时(默认 17 3 * * *) → 同样执行一轮                    │
                    │    │                                                              │
                    │    └─ 每轮结束: 读取 .last-report.json + 比较 servers.js mtime     │
                    │          若有替换(replaced>0) → SIGTERM 重启 server 子进程         │
                    │          使新 CDN_SERVERS 立即生效                                 │
                    └───────────────────────────────────────────────────────────────────┘
 volumes/挂载:
   myspeed-data:/myspeed/data                    （数据库/历史记录，同上游）
   ./server/controller → /myspeed/server/controller （servers.js 修复结果持久化到宿主机仓库）
   ./scripts          → /myspeed/scripts           （备用池 .cdn-backup-pool.json、.last-report.json 持久化）
   ./logs             → /myspeed/logs              （调度器按天滚动日志 + 发现结果 JSON）
```

- 不改动上游 `cdn-discovery.mjs` / `update-cdn-nodes.mjs` / server 业务代码，只做**叠加**，降低后续升级成本（重新 `git pull` 后重打补丁即可）。
- 调度器使用镜像内已装好的 `cron-parser`（node_modules 自带），无需额外安装 cron 守护进程。

### 2. 行为矩阵

| 场景 | 行为 |
|---|---|
| 容器首次启动 | 立即拉起 server；默认 60s 后自动跑一轮（发现 + 探活 + 替换），有替换则重启 server |
| 容器重启（`docker restart` / 宿主机重启 / `restart: unless-stopped`） | 同上：**重启自动触发**一轮 |
| 每天 03:17（`CDN_UPDATE_CRON` 可改） | 定时跑一轮（与 MySpeed 自身自动测速错峰；周期内并发互斥，上一轮未完会跳过本次） |
| 探活发现失效链接 | 从同 CDN 组备用池挑选替代并改写 `servers.js`（`update-cdn-nodes.mjs` 原生逻辑） |
| 有替换发生 | `CDN_RESTART_ON_CHANGE=true` → 自动 SIGTERM 重启 server 子进程（秒级中断，仅替换时发生） |
| 无替换 | 不改文件、不重启 server，零打扰 |
| server 子进程异常退出 | 自动重拉（5s 起指数退避，上限 60s；连续运行 >60s 后重置计数） |
| 手动触发 | `bash manual-cycle.sh`（docker exec 执行一轮，不重启容器） |
| 需要纯原版行为 | 设 `CDN_SERVER_ONLY=true`（只跑 server）；或 `CDN_AUTO_ENABLED=false`（监督但不自动更新） |

---

## 三、文件清单与改动点

| 文件 | 说明 |
|---|---|
| `Dockerfile` | 上游基础上新增（均以 `[CDN-AUTO]` 注释标注）：最终镜像 `COPY ./scripts /myspeed/scripts`（修复缺拷）、`COPY ./docker /myspeed/docker`、`RUN mkdir -p /myspeed/logs`、默认 `CMD ["bun","run","docker/cdn-scheduler.mjs"]` |
| `docker-compose.yml` | 上游基础上新增：环境变量（自动更新开关/节奏/启动触发/重启加载）与 3 个绑定挂载；`healthcheck` 起始期放宽到 60s |
| `docker/cdn-scheduler.mjs` | 新增监督调度器（详见“二”）。纯 Node/Bun 标准库 + `cron-parser`，无新增依赖 |
| `deploy.sh` | 一键部署：clone/更新 → 应用补丁 → `docker compose up -d --build` |
| `apply-to-repo.sh` | 仅把补丁文件应用到一个已克隆的仓库目录 |
| `manual-cycle.sh` | 手动触发一轮并查看报告 |
| `README-CDN-AUTO.md` | 本文档 |

---

## 四、部署

### 方式 A：一键部署（推荐，Docker 主机上执行）

```bash
# 上传/放置本补丁包目录到主机后：
bash deploy.sh myspeed-cn
# 访问 http://<主机IP>:5216
```

### 方式 B：手动

```bash
git clone https://github.com/macrwfuse/myspeed-cdn-auto.git && cd myspeed-cdn-auto
# 把本目录的 Dockerfile、docker-compose.yml 复制进来
# 把 docker/cdn-scheduler.mjs 复制为 docker/cdn-scheduler.mjs
mkdir -p logs
docker compose up -d --build
```

### 验证

```bash
# 1) 服务健康
docker compose ps                                   # myspeed-cn 状态 healthy
curl -s http://localhost:5216/api/info/version

# 2) 调度器与周期日志（启动即会看到一轮 CDN 自动更新）
docker compose logs -f myspeed
#    应出现: [..] 🚀 容器启动/重启：60s 后执行首轮自动更新
#            [..] ▶ 🌐 cdn-discovery.mjs …
#            [..] ▶ 🔧 update-cdn-nodes.mjs …
#            [..] 📊 周期结束 … | replaced=N
#            [..] ⏰ 定时任务: cron="17 3 * * *" → 下次 …

# 3) 报告与留档（已挂载到宿主机仓库目录）
cat scripts/.last-report.json                        # 最近一轮统计
tail logs/cdn-auto-$(date +%F).log                   # 当天日志
ls logs/discovery-*.json                             # 发现结果留档

# 4) 替换生效验证：改一个链接后手动跑一轮
bash manual-cycle.sh
git -C . diff server/controller/servers.js           # 可见被替换的 URL
```

---

## 五、环境变量（均在 docker-compose 中可改）

| 变量 | 默认 | 说明 |
|---|---|---|
| `CDN_AUTO_ENABLED` | `true` | `false` = 只监督 server，不做自动更新 |
| `CDN_SERVER_ONLY` | `false` | `true` = 完全还原上游行为（仅 `bun run server/index.js`） |
| `CDN_UPDATE_CRON` | `17 3 * * *` | 定时节奏（cron 5/6 段均可） |
| `CDN_CRON_TZ` | 取 `TZ`（镜像默认 Asia/Shanghai） | cron 计算时区 |
| `CDN_UPDATE_ON_STARTUP` | `true` | 容器启动/重启即跑首轮（重启自动触发开关） |
| `CDN_UPDATE_START_DELAY_SEC` | `60` | 首轮延迟秒数 |
| `CDN_EXTRA_DISCOVERY` | `true` | 每轮额外单独运行一次 `cdn-discovery.mjs` 并留档（更新脚本内部本就会再发现一次；介意重复可设 false） |
| `CDN_RESTART_ON_CHANGE` | `true` | 有替换时自动重启 server 进程加载新节点 |
| `CDN_CYCLE_TIMEOUT_SEC` | `1200` | 单轮总超时（默认 20 分钟，足够跑完探活 + 备用池验证） |
| `CDN_LOG_DIR` | `/myspeed/logs` | 日志目录（compose 已挂载到宿主机 `./logs`） |

其他沿用上游：`SERVER_PORT`、`HTTPS_PORT`、`DB_TYPE/DB_HOST/DB_NAME/DB_USER/DB_PASS`、`PREVIEW_MODE`、`RUN_TEST_ON_STARTUP`。

---

## 六、持久化、回滚与 Git 回流

- `server/controller`、`scripts`、`logs` 均已绑定挂载到**宿主机上的仓库目录**，因此 `docker compose down` + `up`（重建容器）也不会丢失已修复的节点、备用池与报告。
- 每轮自动替换 = 宿主机仓库里一次可读的改动：

```bash
git -C myspeed-cn diff server/controller/servers.js     # 查看/审阅本次自动修复
git -C myspeed-cn add server/controller/servers.js scripts/.cdn-backup-pool.json
git -C myspeed-cn commit -m "cdn: auto-replace dead links"   # 可选：把修复回流到你自己的仓库
```

- 回滚：`git checkout -- server/controller/servers.js` 后 `docker restart myspeed-cn` 即可。

---

## 七、故障排查与边界说明

| 现象 | 原因 / 处理 |
|---|---|
| 在 Windows 上编辑过 `.sh`/`.mjs` 后上传，`bash *.sh` 报 `$'\r': command not found` | 文件被存成 CRLF。执行 `sed -i 's/\r$//' deploy.sh apply-to-repo.sh manual-cycle.sh`，或在上传前把行尾改为 LF |
| 日志里 `cdn-discovery` 部分来源为 0 | 中国大陆网络访问 `raw.githubusercontent.com` 常失败，脚本对此做了容错（catch 后跳过），仍有大厂/运营商等国内来源兜底，属预期。Node/Bun 的 `fetch` **不读 `http_proxy` 环境变量**；如确需代理，可在容器内为脚本进程注入代理（如 `HTTPS_PROXY` 对 fetch 无效，需用 `bun -e` + undici `ProxyAgent` 之类的改造，属可选增强）。 |
| 某些链接 HEAD 返回 403/405 | 脚本已内置 GET + `Range: bytes=0-0` 兜底，多数 403 是 CDN 对 HEAD 的拦截，会走兜底判定。 |
| 报告 `replaced < dead`、周期 exit 1 | 部分失效链接在备用池中找不到同组可用替代，脚本保留原样并退出 1；调度器会照常记日志、不崩溃。可 `bash manual-cycle.sh` 人工核对，或手动补充该组候选。 |
| server 重启后自动测速又被触发 | 若你开了 `RUN_TEST_ON_STARTUP=true`，每次替换重启 server 都会触发一次自动测速——属正常副作用；介意可关闭该变量。 |
| 更新了上游仓库代码 | 补丁均为叠加文件：`git pull` 后重新 `bash apply-to-repo.sh .`，再 `docker compose up -d --build`。若上游改了 `scripts/*.mjs` 或 `servers.js` 结构，先 `git diff` 确认兼容。 |
| 备用池随时间变大 | `update-cdn-nodes.mjs` 每轮会先验证池内链接再落盘，天然会剔除失效项；候选来源(发现/静态种子)会持续补充。若希望限制池大小或跳过全池验证，属对上游脚本的可选增强，可按需自行 patch（当前补丁刻意不改上游脚本）。 |
| 测速节点“上传/上行” | 更新脚本目前只探活**下载链接**（`downloadUrl(s)`）；`uploadUrl(s)` 多为固定教育网/Cloudflare 上行，未纳入检查，属上游脚本既定边界。 |

---

## 八、改动纪律

1. 只改 `Dockerfile` 入口/拷入内容与 `docker-compose.yml`，**不修改** `server/` 业务代码与 `scripts/` 两个自动化脚本本身；
2. 所有 `[CDN-AUTO]` 标记便于将来与上游 diff；
3. 调度器退出码/日志均打到 `docker logs` 与 `logs/cdn-auto-*.log`，排障先看这两个地方。
