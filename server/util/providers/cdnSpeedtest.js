/**
 * CDN Speed Test Provider
 * HTTP 多流并发下载测速 — 基于 NetworkPanel / speed.do 的测速原理
 *
 * 测速方式：同时发起多个 HTTP GET 请求下载大文件，统计总字节数和耗时，计算带宽。
 * 与 Ookla/LibreSpeed 不同，不需要专用测速服务器，直接利用 CDN 下载链接。
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

// 测速参数
const TEST_DURATION_MS = 10000;   // 下载测速持续时间 (ms)
const GRACE_PERIOD_MS  = 1000;    // 预热时间 (ms)
const STREAMS          = 6;       // 并发流数
const PING_COUNT       = 10;      // ping 次数

/**
 * 上传端点适配 — 按主机自动匹配请求方式（CDN 上传池 CDN_UPLOAD_URLS 的备注在此落实）
 *   - speed.cloudflare.com/__up : 需带 UA/Origin，URL 不带额外参数
 *   - netsp.master.qq.com       : QQ管家协议 multipart/form-data，且仅单流
 *   - 其余（mbd.baidu.com / vcs.zijieapi.com 等）: 多流 octet-stream 直传
 */
function uploadProfile(uploadUrl) {
    let host = '';
    try { host = new URL(uploadUrl).hostname; } catch { return {}; }

    if (host === 'speed.cloudflare.com') {
        return {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Origin': 'https://speed.cloudflare.com',
            },
        };
    }
    if (host === 'netsp.master.qq.com') {
        return { multipart: true, singleStream: true };
    }
    return {};
}

/**
 * 通过 HTTP HEAD 测量延迟 (类似 ICMP ping)
 */
async function measurePing(url, count = PING_COUNT) {
    const latencies = [];
    for (let i = 0; i < count; i++) {
        const start = Date.now();
        await new Promise((resolve) => {
            const parsed = new URL(url);
            const mod = parsed.protocol === 'https:' ? https : http;
            const req = mod.request(parsed, { method: 'HEAD', timeout: 5000 }, () => {
                latencies.push(Date.now() - start);
                resolve();
            });
            req.on('error', () => {
                latencies.push(Date.now() - start);
                resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                latencies.push(5000);
                resolve();
            });
            req.end();
        });
        await new Promise(r => setTimeout(r, 200));
    }

    if (latencies.length === 0) return { ping: 0, jitter: 0 };

    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const variance = latencies.reduce((sum, v) => sum + (v - avg) ** 2, 0) / latencies.length;
    const jitter = Math.round(Math.sqrt(variance));

    return { ping: avg, jitter };
}

/**
 * 单个下载流：持续下载直到 stopped=true
 */
function startDownloadStream(url, stats, stopped) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;

        const doRequest = () => {
            if (stopped.value) return resolve();

            const req = mod.get(url + (url.includes('?') ? '&' : '?') + '_nocache=' + Math.random(), {
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                timeout: 15000,
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    res.resume();
                    const redirMod = redirectUrl.startsWith('https') ? https : http;
                    redirMod.get(redirectUrl, (res2) => {
                        res2.on('data', (chunk) => {
                            if (!stopped.value) stats.totalBytes += chunk.length;
                        });
                        res2.on('end', () => {
                            if (!stopped.value) doRequest();
                            else resolve();
                        });
                        res2.on('error', () => {
                            if (!stopped.value) setTimeout(doRequest, 1000);
                            else resolve();
                        });
                    }).on('error', () => {
                        if (!stopped.value) setTimeout(doRequest, 1000);
                        else resolve();
                    });
                    return;
                }

                res.on('data', (chunk) => {
                    if (!stopped.value) stats.totalBytes += chunk.length;
                });
                res.on('end', () => {
                    if (!stopped.value) doRequest();
                    else resolve();
                });
                res.on('error', () => {
                    if (!stopped.value) setTimeout(doRequest, 1000);
                    else resolve();
                });
            });

            req.on('error', () => {
                if (!stopped.value) setTimeout(doRequest, 1000);
                else resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                if (!stopped.value) setTimeout(doRequest, 1000);
                else resolve();
            });
        };

        doRequest();
    });
}

/**
 * 多流并发下载测速
 */
async function measureDownload(downloadUrl, streams = STREAMS, durationMs = TEST_DURATION_MS) {
    const stats = { totalBytes: 0 };
    const stopped = { value: false };

    const streamPromises = [];
    for (let i = 0; i < streams; i++) {
        streamPromises.push(
            new Promise(resolve => setTimeout(() => {
                startDownloadStream(downloadUrl, stats, stopped).then(resolve);
            }, i * 100))
        );
    }

    await new Promise(r => setTimeout(r, GRACE_PERIOD_MS));
    stats.totalBytes = 0;

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, durationMs));
    stopped.value = true;

    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSec = stats.totalBytes / elapsed;
    const mbps = (bytesPerSec * 8) / 1_000_000;

    await Promise.allSettled(streamPromises);

    return {
        download: parseFloat(mbps.toFixed(2)),
        downloadBytes: stats.totalBytes,
    };
}

/**
 * 测量上传速度
 */
function startUploadStream(url, stats, stopped, profile = {}) {
    return new Promise((resolve) => {
        const chunkSize = 128 * 1024;
        const chunk = Buffer.alloc(chunkSize);
        for (let i = 0; i < chunkSize; i++) chunk[i] = Math.floor(Math.random() * 256);
        const boundary = '----MySpeed' + Math.random().toString(16).slice(2);

        const doUpload = () => {
            if (stopped.value) return resolve();

            let blob = Buffer.concat(Array(16).fill(chunk));
            const headers = { ...(profile.headers || {}) };
            if (profile.multipart) {
                // QQ管家协议：multipart/form-data（实测仅单流可用，由调用方置 streams=1）
                const head = Buffer.from(
                    `--${boundary}\r\n` +
                    'Content-Disposition: form-data; name="data"; filename="speed.bin"\r\n' +
                    'Content-Type: application/octet-stream\r\n\r\n'
                );
                const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
                blob = Buffer.concat([head, blob, tail]);
                headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
            } else {
                headers['Content-Type'] = 'application/octet-stream';
            }
            headers['Content-Length'] = blob.length;

            const parsed = new URL(url);
            const mod = parsed.protocol === 'https:' ? https : http;

            const req = mod.request(parsed, {
                method: 'POST',
                headers: headers,
                timeout: 15000,
            }, (res) => {
                res.resume();
                stats.totalBytes += blob.length;
                if (!stopped.value) doUpload();
                else resolve();
            });

            req.on('error', () => {
                if (!stopped.value) setTimeout(doUpload, 1000);
                else resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                if (!stopped.value) setTimeout(doUpload, 1000);
                else resolve();
            });

            req.write(blob);
            req.end();
        };

        doUpload();
    });
}

async function measureUpload(uploadUrl, streams = STREAMS, durationMs = TEST_DURATION_MS, profile = {}) {
    const stats = { totalBytes: 0 };
    const stopped = { value: false };

    const streamPromises = [];
    for (let i = 0; i < streams; i++) {
        streamPromises.push(
            new Promise(resolve => setTimeout(() => {
                startUploadStream(uploadUrl, stats, stopped, profile).then(resolve);
            }, i * 100))
        );
    }

    await new Promise(r => setTimeout(r, GRACE_PERIOD_MS));
    stats.totalBytes = 0;

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, durationMs));
    stopped.value = true;

    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSec = stats.totalBytes / elapsed;
    const mbps = (bytesPerSec * 8) / 1_000_000;

    await Promise.allSettled(streamPromises);

    return {
        upload: parseFloat(mbps.toFixed(2)),
        uploadBytes: stats.totalBytes,
    };
}

/**
 * 从数组中随机选取一个元素
 */
function pickRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 主入口：执行 CDN 测速
 * @param {object} serverConfig - {
 *   name, downloadUrl, downloadUrls, uploadUrl, uploadUrls, pingUrl,
 *   streams?, downloadTime?, uploadTime?
 * }
 * @returns {object} - 与 LibreSpeed 结果格式兼容
 *
 * 多URL支持：
 *   - downloadUrls: 下载链接数组，测速时随机选取一个
 *   - uploadUrls: 上传链接数组，测速时随机选取一个
 *   - 向后兼容 downloadUrl / uploadUrl 单链接
 */
export async function runCdnSpeedtest(serverConfig) {
    const startTime = Date.now();

    const {
        name = 'CDN Server',
        downloadUrl,
        downloadUrls,
        uploadUrl,
        uploadUrls,
        pingUrl,
        streams: numStreams = STREAMS,
        downloadTime = 10,
        uploadTime = 10,
    } = serverConfig;

    // 确定下载URL：优先从 downloadUrls 数组随机选取，否则用 downloadUrl
    const resolvedDlUrl = pickRandom(downloadUrls) || downloadUrl;
    if (!resolvedDlUrl) throw new Error('CDN 测速需要 downloadUrl 或 downloadUrls');

    // 确定上传URL：优先从 uploadUrls 数组随机选取，否则用 uploadUrl
    const resolvedUlUrl = pickRandom(uploadUrls) || uploadUrl;
    // 上传端点请求方式/流数适配（CF 带 UA/Origin；QQ multipart 仅单流）
    const ulProfile = resolvedUlUrl ? uploadProfile(resolvedUlUrl) : null;

    // 1. Ping
    const pingTarget = pingUrl || resolvedDlUrl;
    const { ping, jitter } = await measurePing(pingTarget);

    // 2. Download
    const dlResult = await measureDownload(resolvedDlUrl, numStreams, downloadTime * 1000);

    // 3. Upload (如果配置了上传 URL)
    let ulResult = { upload: 0, uploadBytes: 0 };
    if (resolvedUlUrl) {
        const ulStreams = ulProfile && ulProfile.singleStream ? 1 : numStreams;
        ulResult = await measureUpload(resolvedUlUrl, ulStreams, uploadTime * 1000, ulProfile);
    }

    const elapsed = Date.now() - startTime;

    return {
        ping: ping,
        jitter: jitter,
        download: dlResult.download,
        upload: ulResult.upload,
        server: {
            name: name,
            url: resolvedDlUrl,
        },
        elapsed: elapsed,
        downloadBytes: dlResult.downloadBytes,
        uploadBytes: ulResult.uploadBytes,
    };
}
