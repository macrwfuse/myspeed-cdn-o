#!/usr/bin/env bun
/**
 * MySpeed-CN · CDN 节点自动更新 —— 容器内监督调度器 (docker/cdn-scheduler.mjs)
 * =========================================================================
 * 职责（作为镜像默认 CMD / PID 1 运行）：
 *   1. 拉起并持续监督 MySpeed server 子进程（崩溃自动重拉，SIGTERM 优雅退出）；
 *   2. 容器启动 / 每次重启后，自动执行一轮「CDN 发现 + 链接有效性检查 + 失效替换」；
 *   3. 按 cron（环境变量 CDN_UPDATE_CRON，默认每天 03:17）定时重复执行；
 *   4. 当某轮发现 servers.js 被脚本修复（有链接被替换）时，自动重启 server 子进程，
 *      使新节点列表立即生效（servers.js 为静态 import + 模块级缓存，必须重启进程才能加载）。
 *
 * 环境变量：
 *   CDN_AUTO_ENABLED           true|false   默认 true  （false=只监督 server，不自动更新）
 *   CDN_SERVER_ONLY            true|false   默认 false （true=完全还原上游行为：只跑 server）
 *   CDN_UPDATE_CRON            cron 表达式  默认 "17 3 * * *"（每天 03:17；支持 5/6 段）
 *   CDN_CRON_TZ                时区          默认取 TZ（如 Asia/Shanghai）
 *   CDN_UPDATE_ON_STARTUP      true|false   默认 true  （启动/重启即跑首轮）
 *   CDN_UPDATE_START_DELAY_SEC 秒           默认 60    （首轮延迟，让服务先就绪）
 *   CDN_EXTRA_DISCOVERY        true|false   默认 true  （每轮额外单独跑 cdn-discovery.mjs，
 *                                                        结果存 logs/discovery-*.json；更新脚本内部本就会再发现一次）
 *   CDN_RESTART_ON_CHANGE      true|false   默认 true  （有替换时自动重启 server 进程）
 *   CDN_CYCLE_TIMEOUT_SEC      秒           默认 1200  （单轮总超时）
 *   CDN_LOG_DIR                目录          默认 /myspeed/logs（按天滚动日志）
 *
 * 说明：cdn-discovery.mjs 与 update-cdn-nodes.mjs 运行于 /myspeed/scripts；
 *       自动修复写入 /myspeed/server/controller/servers.js（建议 docker-compose 绑定挂载持久化）。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CronExpressionParser } from 'cron-parser';

// ─────────────────────────── 常量与配置 ───────────────────────────
const PROJECT_ROOT = '/myspeed';
const SERVERS_JS = path.join(PROJECT_ROOT, 'server', 'controller', 'servers.js');
const DISCOVERY_JS = path.join(PROJECT_ROOT, 'scripts', 'cdn-discovery.mjs');
const UPDATE_JS = path.join(PROJECT_ROOT, 'scripts', 'update-cdn-nodes.mjs');
const REPORT_JSON = path.join(PROJECT_ROOT, 'scripts', '.last-report.json');
const DEFAULT_LOG_DIR = path.join(PROJECT_ROOT, 'logs');

const env = (k, d = '') => (process.env[k] ?? d);
const envBool = (k, d = false) => {
    const v = env(k, '');
    return v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const envInt = (k, d) => {
    const n = parseInt(env(k, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : d;
};

const C = {
    enabled: envBool('CDN_AUTO_ENABLED', true),
    serverOnly: envBool('CDN_SERVER_ONLY', false),
    cron: env('CDN_UPDATE_CRON', '17 3 * * *'),
    cronTz: env('CDN_CRON_TZ', env('TZ', '')),
    onStartup: envBool('CDN_UPDATE_ON_STARTUP', true),
    startDelaySec: envInt('CDN_UPDATE_START_DELAY_SEC', 60),
    extraDiscovery: envBool('CDN_EXTRA_DISCOVERY', true),
    restartOnChange: envBool('CDN_RESTART_ON_CHANGE', true),
    cycleTimeoutMs: envInt('CDN_CYCLE_TIMEOUT_SEC', 1200) * 1000,
    logDir: env('CDN_LOG_DIR', DEFAULT_LOG_DIR),
};

// ─────────────────────────── 运行状态 ───────────────────────────
let serverProc = null;
let stopping = false;
let cycleBusy = false;
let respawnArmed = true;      // server 子进程是否允许被自动拉起
let respawnAttempts = 0;
let cronTimer = null;
let logStream = null;
let logStreamDate = '';
let fileLogOk = true;

// ─────────────────────────── 日志（stdout + 按天文件）───────────────────────────
function rotateLogStream() {
    if (!fileLogOk) return;
    try {
        fs.mkdirSync(C.logDir, { recursive: true });
        const today = new Date().toISOString().slice(0, 10);
        if (!logStream || logStreamDate !== today) {
            if (logStream) logStream.end();
            logStreamDate = today;
            logStream = fs.createWriteStream(path.join(C.logDir, `cdn-auto-${today}.log`), { flags: 'a' });
        }
    } catch { fileLogOk = false; }
}

function log(...a) {
    const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
    console.log(line);
    try {
        rotateLogStream();
        if (logStream) logStream.write(line + '\n');
    } catch { /* 日志文件不可写时忽略 */ }
}

function forwardChunk(chunk) {
    process.stdout.write(chunk);
    try {
        rotateLogStream();
        if (logStream) logStream.write(chunk);
    } catch { /* ignore */ }
}

// ─────────────────────────── 工具 ───────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function mtimeMs(p) {
    try { return fs.statSync(p).mtimeMs; } catch { return -1; }
}

function readReport() {
    try { return JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8')); } catch { return null; }
}

/**
 * 运行一个 bun 子进程脚本。
 * @param {string[]} runArgs  如 ['scripts/update-cdn-nodes.mjs','--verbose']
 * @param {string} label      日志标签
 * @param {number} timeoutMs  超时后 SIGKILL
 * @param {{capture?:boolean}} opts capture=true 时把 stdout 收集返回（不转发），stderr 始终转发
 */
function runScript(runArgs, label, timeoutMs, opts = {}) {
    return new Promise((resolve) => {
        log(`▶ ${label}`);
        let child;
        try {
            // stdout/stderr 均走管道：统一 tee 到 docker logs 与按天日志文件
            child = spawn(process.execPath, ['run', ...runArgs], {
                cwd: PROJECT_ROOT,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            log(`✗ ${label} 无法启动: ${e.message}`);
            resolve({ code: -1, stdout: '' });
            return;
        }

        const killer = setTimeout(() => {
            log(`⏰ ${label} 超时(${Math.round(timeoutMs / 1000)}s)，已终止`);
            try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }, timeoutMs);

        let collected = '';
        const onOut = (c) => {
            if (opts.capture) {
                collected = (collected + c.toString()).slice(-4 * 1024 * 1024);
            } else {
                forwardChunk(c);
            }
        };
        child.stdout.on('data', onOut);
        child.stderr.on('data', forwardChunk);
        child.on('error', (e) => {
            clearTimeout(killer);
            log(`✗ ${label} 错误: ${e.message}`);
            resolve({ code: -1, stdout: collected });
        });
        child.on('exit', (code, signal) => {
            clearTimeout(killer);
            log(`✔ ${label} 结束 code=${code}${signal ? ` signal=${signal}` : ''}`);
            resolve({ code, stdout: collected });
        });
    });
}

// ─────────────────────────── server 进程管理 ───────────────────────────
function startServer() {
    if (serverProc || stopping) return;
    respawnArmed = true;
    log('▶ 启动 MySpeed server 子进程: bun run server/index.js');
    let child;
    try {
        child = spawn(process.execPath, ['run', 'server/index.js'], {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'inherit', 'inherit'],
            env: process.env,
        });
    } catch (e) {
        log(`✗ server 启动失败: ${e.message}`);
        scheduleRespawn();
        return;
    }
    child.startedAt = Date.now();
    serverProc = child;

    child.on('error', (e) => {
        const was = serverProc === child;
        serverProc = null;
        if (was) log(`✗ server 进程错误: ${e.message}`);
        if (!stopping && respawnArmed) scheduleRespawn();
    });
    child.on('exit', (code, signal) => {
        const was = serverProc === child;
        serverProc = null;
        const uptime = Math.round((Date.now() - (child.startedAt || Date.now())) / 1000);
        log(`⏹ server 子进程退出 code=${code}${signal ? ` signal=${signal}` : ''} (存活 ${uptime}s)`);
        if (uptime > 60) respawnAttempts = 0;
        if (stopping) return;
        if (!respawnArmed) {
            log('· server 由监督器主动停止，不自动拉起');
            return;
        }
        scheduleRespawn();
    });
}

function scheduleRespawn() {
    const delay = Math.min(60_000, 5_000 * Math.pow(2, Math.min(respawnAttempts, 4)));
    respawnAttempts += 1;
    log(`↻ 将在 ${Math.round(delay / 1000)}s 后重新拉起 server（第 ${respawnAttempts} 次尝试）`);
    setTimeout(() => { if (!stopping) startServer(); }, delay);
}

async function stopServer() {
    const child = serverProc;
    if (!child) return;
    respawnArmed = false;
    serverProc = null;
    log('⏹ 向 server 子进程发送 SIGTERM …');
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
    const exited = new Promise((r) => child.once('exit', r));
    const killer = setTimeout(() => {
        log('⚠ server 未在 15s 内退出，发送 SIGKILL');
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 15_000);
    await exited;
    clearTimeout(killer);
    log('✔ server 子进程已停止');
}

// ─────────────────────────── CDN 更新周期 ───────────────────────────
async function runCycle(reason) {
    if (stopping) return;
    if (cycleBusy) { log(`⏭ 上一轮尚未结束，跳过本次触发: ${reason}`); return; }
    if (!C.enabled) return;

    cycleBusy = true;
    const startedAt = Date.now();
    const beforeM = mtimeMs(SERVERS_JS);
    log('══════════════════════════════════════════════════');
    log(`🔄 CDN 自动更新周期开始 — 触发: ${reason}`);
    log('══════════════════════════════════════════════════');

    try {
        // 步骤 0（可选）：单独运行互联网发现脚本，产物留档
        if (C.extraDiscovery) {
            const disc = await runScript(
                [path.relative(PROJECT_ROOT, DISCOVERY_JS), '--json'],
                '🌐 cdn-discovery.mjs（互联网发现）',
                Math.min(C.cycleTimeoutMs, 240_000),
                { capture: true },
            );
            if (disc.code === 0 && disc.stdout.trim()) {
                try {
                    const parsed = JSON.parse(disc.stdout);
                    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const out = path.join(C.logDir, `discovery-${ts}.json`);
                    fs.mkdirSync(C.logDir, { recursive: true });
                    fs.writeFileSync(out, disc.stdout, 'utf8');
                    log(`📄 发现结果已留档: ${out}（${Array.isArray(parsed) ? parsed.length : '?'} 个候选）`);
                } catch { log('⚠ cdn-discovery 输出不是有效 JSON，仅记录在容器日志'); }
            }
        }

        // 步骤 1：更新脚本（内部含 探活 + 发现 + 备用池验证 + 失效替换，写 servers.js / .last-report.json）
        await runScript(
            [path.relative(PROJECT_ROOT, UPDATE_JS), '--verbose'],
            '🔧 update-cdn-nodes.mjs（探活+替换）',
            C.cycleTimeoutMs,
        );

        // 步骤 2：判断是否发生了替换（servers.js mtime 变化，或报告 replaced>0）
        const afterM = mtimeMs(SERVERS_JS);
        const report = readReport();
        const fileChanged = beforeM >= 0 && afterM >= 0 && afterM !== beforeM;
        const replaced = report && Number.isInteger(report.replaced) ? report.replaced : 0;
        const cost = ((Date.now() - startedAt) / 1000).toFixed(1);
        log(`📊 周期结束 耗时${cost}s | servers.js 变化=${fileChanged ? '是' : '否'}` +
            (report
                ? ` | 报告 total=${report.total} alive=${report.alive} dead=${report.dead} replaced=${replaced}`
                : ' | 未读取到 .last-report.json'));

        if ((fileChanged || replaced > 0) && C.restartOnChange && !stopping) {
            log('🔁 检测到 CDN 链接已被自动替换 → 重启 server 进程以加载新节点列表');
            await stopServer();
            if (!stopping) startServer();
        }
    } catch (e) {
        log(`✗ 周期异常: ${e?.stack || e}`);
    } finally {
        cycleBusy = false;
    }
}

// ─────────────────────────── cron 调度 ───────────────────────────
function armNext() {
    if (stopping || !C.enabled) return;
    let delayMs;
    try {
        const opts = {};
        if (C.cronTz) opts.tz = C.cronTz;
        const it = CronExpressionParser.parse(C.cron, opts);
        const next = it.next().getTime();
        delayMs = Math.max(2_000, next - Date.now());
        log(`⏰ 定时任务: cron="${C.cron}"${opts.tz ? ` tz=${opts.tz}` : ''} → 下次 ${new Date(next).toISOString()}`);
    } catch (e) {
        log(`⚠ cron 表达式无效（${e.message}），回退为每 24 小时执行一次`);
        delayMs = 24 * 3600 * 1000;
    }
    cronTimer = setTimeout(() => {
        armNext();                       // 先排下一次，避免周期耗时影响节奏
        runCycle(`定时触发 ${C.cron}`).then(() => {});
    }, delayMs);
}

// ─────────────────────────── 启动与退出 ───────────────────────────
function installShutdown() {
    let installed = false;
    return (sig) => {
        if (installed) return;
        installed = true;
        process.on(sig, () => {
            if (stopping) return;
            stopping = true;
            log(`收到 ${sig}，开始优雅退出…`);
            if (cronTimer) clearTimeout(cronTimer);
            stopServer().finally(() => {
                try { if (logStream) logStream.end(); } catch { /* ignore */ }
                process.exit(0);
            });
        });
    };
}

async function main() {
    log('══════════════════════════════════════════════════');
    log('🚀 MySpeed-CN CDN 自动更新 · 监督调度器启动');
    log(`   自动更新=${C.enabled} | cron=${C.cron} | 启动即跑=${C.onStartup}` +
        (C.enabled ? ` | 启动延迟=${C.startDelaySec}s | 重启加载=${C.restartOnChange}` : ''));
    log('══════════════════════════════════════════════════');

    installShutdown()('SIGTERM');
    installShutdown()('SIGINT');
    process.on('unhandledRejection', (e) => log('⚠ unhandledRejection:', e));

    if (C.serverOnly) {
        log('CDN_SERVER_ONLY=true → 仅运行 server（等价于原版镜像行为）');
        startServer();
        await new Promise(() => {});      // 由子进程与信号维持事件循环
        return;
    }

    // 1) 先拉起 server，保证 Web 服务尽快可用
    startServer();

    if (!C.enabled) {
        log('CDN_AUTO_ENABLED=false → 不执行自动更新，仅监督 server 进程');
        return;
    }

    // 2) 前置检查
    if (!fs.existsSync(UPDATE_JS) || !fs.existsSync(SERVERS_JS)) {
        log(`⚠ 未找到 ${UPDATE_JS} 或 ${SERVERS_JS}，自动更新不可用（请确认镜像包含 ./scripts）`);
        return;
    }

    // 3) 容器启动/重启自动触发首轮（“容器重启自动触发”）
    if (C.onStartup) {
        log(`🚀 容器启动/重启：${C.startDelaySec}s 后执行首轮自动更新`);
        setTimeout(() => runCycle('容器启动/重启'), C.startDelaySec * 1000);
    }

    // 4) 定时循环
    armNext();
}

main().then(() => {}).catch((e) => {
    console.error('调度器启动失败:', e);
    process.exit(1);
});
