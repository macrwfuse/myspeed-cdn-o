import fs from 'node:fs';

// ── 🇨🇳 国内 Ookla Speedtest 节点 ──
// 来源: spiritLHLS/speedtest.net-CN-ID
export const OOKLA_CN_SERVERS = {
    "3633": {
        name: "中国电线",
        sponsor: "China Telecom",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "222.68.195.2:8080"
    },
    "5396": {
        name: "南京",
        sponsor: "China Telecom JiangSu 5G",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "115.169.22.22:8080"
    },
    "59386": {
        name: "杭州",
        sponsor: "China Telecom/浙江电信",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "61.130.56.1:8080"
    },
    "16204": {
        name: "苏州",
        sponsor: "China Mobile/JSQY - Suzhou",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "36.156.46.53:8080"
    },
    "24447": {
        name: "中国联通",
        sponsor: "China Unicom",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "210.22.155.34:8080"
    },
    "30852": {
        name: "昆山",
        sponsor: "昆山杜克大学",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "speedtest.dukekunshan.edu.cn:8080"
    },
    "36663": {
        name: "镇江",
        sponsor: "江苏电信 5G",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "5gzhenjiang.speedtest.jsinfo.net:8080"
    },
    "43752": {
        name: "北京",
        sponsor: "北京联通",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "beijing.unicomtest.com:8080"
    },
    "59387": {
        name: "宁波",
        sponsor: "浙江电信",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "cesu-nb.zjtelecom.com.cn:8080"
    },
    "17265": {
        name: "中和",
        sponsor: "远传电信 (台湾)",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "fetsz1.seed.net.tw:8080"
    },
    "73010": {
        name: "贺兰",
        sponsor: "Arslan Telecom",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "arslantel.online:8080"
    }
};

// ── 🎓 国内 LibreSpeed 教育网节点 ──
// 来源: builtin-node-config.js 节点6方案
export const LIBRE_CN_SERVERS = {
    "cn-edu-ustc": {
        id: "cn-edu-ustc",
        name: "教育网 · 中科大 (LibreSpeed)",
        server: "https://test.ustc.edu.cn/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-tsinghua": {
        id: "cn-edu-tsinghua",
        name: "教育网 · 清华 (LibreSpeed)",
        server: "https://iptv.tsinghua.edu.cn/st/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-sjtu": {
        id: "cn-edu-sjtu",
        name: "教育网 · 上交 (LibreSpeed)",
        server: "https://ftp.sjtu.edu.cn/speedtest/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-nju": {
        id: "cn-edu-nju",
        name: "教育网 · 南大 (LibreSpeed)",
        server: "https://fs.nju.edu.cn/speed/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-zju": {
        id: "cn-edu-zju",
        name: "教育网 · 浙大 (LibreSpeed)",
        server: "http://speedtest.zju.edu.cn",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-whut": {
        id: "cn-edu-whut",
        name: "教育网 · 武汉理工 (LibreSpeed)",
        server: "https://219.140.61.101/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-hubei": {
        id: "cn-edu-hubei",
        name: "教育网 · 湖北节点 (LibreSpeed)",
        server: "https://119.36.86.250:81/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-wh": {
        id: "cn-edu-wh",
        name: "教育网 · 武汉节点 (LibreSpeed)",
        server: "http://211.67.53.2/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    }
};

// ── 🌐 CDN 下载测速节点 ──
// 来源: NetworkPanel / speed.do

// ── CDN 上传测速端点池（实测：mbd.baidu 41.7 / vcs.zijie 55.7 / Cloudflare 28.2 / QQ netspeed 62.7 Mbps）──
// 仅用于 CDN 测速节点（cdn-* / speeddo-cf-us）；Ookla / LibreSpeed 节点不受影响。
// 备注：
//   mbd.baidu.com / vcs.zijieapi.com        多流 octet-stream 直传即可（speed.do/st 核心1/2）
//   speed.cloudflare.com/__up               需带 UA/Origin 且 URL 不带额外参数
//   netsp.master.qq.com/cgi-bin/netspeed    QQ管家协议 multipart、仅单流
// 请求方式的自动适配在 server/util/providers/cdnSpeedtest.js（按主机匹配）。
export const CDN_UPLOAD_URLS = [
    "https://mbd.baidu.com/ztbox?action=zpblog&nocache=1",
    "https://vcs.zijieapi.com/vc/setting?aid=6383&pageId=6241&nocache=1",
    "https://speed.cloudflare.com/__up",
    "http://netsp.master.qq.com/cgi-bin/netspeed"
];

export const CDN_SERVERS = {
    "cdn-cloudflare-25m": {
        id: "cdn-cloudflare-25m",
        name: "Cloudflare · 25MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cloudflare-100m": {
        id: "cdn-cloudflare-100m",
        name: "Cloudflare · 100MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=100000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cachefly": {
        id: "cdn-cachefly",
        name: "CacheFly 全球 CDN",
        downloadUrl: "https://web1.cachefly.net/speedtest/downloading",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://web1.cachefly.net/speedtest/downloading",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-steam-akamai": {
        id: "cdn-steam-akamai",
        name: "Steam Akamai CDN",
        downloadUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://cdn.akamai.steamstatic.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-byte": {
        id: "cdn-byte",
        name: "字节 CDN",
        downloadUrl: "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://lf3-cdn-tos.bytecdntp.com/",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-qiniu": {
        id: "cdn-qiniu",
        name: "七牛 CDN",
        downloadUrl: "https://devtools.qiniu.com/linux/amd64/qrsctl",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://devtools.qiniu.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-aliyun": {
        id: "cdn-aliyun",
        name: "阿里 CDN",
        downloadUrl: "https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://gw.alipayobjects.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-baidu": {
        id: "cdn-baidu",
        name: "百度网盘 CDN",
        downloadUrl: "https://issuepcdn.baidupcs.com/issue/netdisk/LinuxGuanjia/4.17.7/baidunetdisk_4.17.7_amd64.deb",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://issuepcdn.baidupcs.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-wangyi": {
        id: "cdn-wangyi",
        name: "网易 CDN",
        downloadUrl: "https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://open-image.ws.126.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-microsoft": {
        id: "cdn-microsoft",
        name: "Microsoft Akamai CDN",
        downloadUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW16Ptm",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── speed.do 节点 ──
    "speeddo-dl1": {
        id: "speeddo-dl1",
        name: "【下载节点1】Ookla 浙江电信",
        downloadUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-dl2": {
        id: "speeddo-dl2",
        name: "【下载节点2】Ookla 南京电信",
        downloadUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-cf-us": {
        id: "speeddo-cf-us",
        name: "【CloudFlare】美国节点",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-telecom-gd": {
        id: "speeddo-telecom-gd",
        name: "【电信节点】广东专线节点",
        downloadUrl: "http://211.136.30.118:9000/speed/10.data",
        uploadUrl: "http://113.229.96.166:8800/Dat/upServer",
        pingUrl: "http://211.136.30.118:9000/speed/10.data",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-unicom": {
        id: "speeddo-unicom",
        name: "【联通节点】全国多线节点",
        downloadUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-mobile": {
        id: "speeddo-mobile",
        name: "【移动节点】北京&河北专线节点",
        downloadUrl: "https://server-16204.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "http://113.229.96.166:8800/Dat/upServer",
        pingUrl: "https://server-16204.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-edu": {
        id: "speeddo-edu",
        name: "【教育网】USTC 多线节点",
        downloadUrl: "https://test.ustc.edu.cn/backend/garbage.php",
        uploadUrl: "https://test.ustc.edu.cn/backend/empty.php",
        pingUrl: "https://test.ustc.edu.cn/backend/empty.php?cors=1",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },

    // ═══════════════════════════════════════════════════
    //  新增 CDN 节点组 — 每组按 CDN 列表名作为节点名
    //  测速时从各自列表中随机选取一个下载链接
    //  Ping 统一使用 http://webcdn.m.qq.com
    // ═══════════════════════════════════════════════════

    // ── 和彩云 CDN ──
    "cdn-mcloud": {
        id: "cdn-mcloud",
        name: "和彩云 CDN",
        downloadUrls: [
            "https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 天翼云 CDN ──
    "cdn-ctyun": {
        id: "cdn-ctyun",
        name: "天翼云 CDN",
        downloadUrls: [
            "https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── Speedo云 CDN (30个下载源，随机选取) ──
    "cdn-speedo": {
        id: "cdn-speedo",
        name: "Speedo云 CDN",
        downloadUrls: [
            "https://cdn.aixifan.com/downloads/AcfunLive-Setup-1.9.0.200-ReleaseX64_6d5c40.exe",
            "https://devtools.qiniu.com/linux/amd64/qrsctl",
            "https://devtools.qiniu.com/qdoractl-darwin-amd64-0.4.6",
            "https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe",
            "https://downapp.sina.cn/m/06/sinaNews_8.27.0_1719288606_4386_3538_armeabi-v7a.apk",
            "https://i1.sinaimg.cn/edu/sinaopen/SinaOpencourse_V2.02.apk",
            "https://statics.itc.cn/lt-app/sohumobile_official_gray_optimizeRelease_4_1.0.3_01161850.apk",
            "https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk",
            "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
            "https://lf6-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
            "https://wwwstatic.vivo.com.cn/vivoportal/files/download/app/20231026/350bda07c8a0719919bcadbf5aea3538.apk",
            "https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk",
            "https://uu.gdl.netease.com/4112/UU-4.68.1.exe",
            "https://cd.pddpic.com/android_dev/2024-06-26/06027b4121edcd1f106d992128a7124b.apk",
            "https://cd.pddpic.com/volantis-open/volantis-common/app/com.xunmeng.workBench/Release_1834716.exe",
            "https://cdn-ws.up366.cn/cn/files/setup/C72C242ED8400001EE2178A912E01146/2022/06/21/4dca83b3e1c461e070f75d2b485e75e7/up366-5.6.6.0.exe",
            "https://open-image.ws.126.net/android_phone_release-sp_open-v9.10.1-vb7b79d6b531448baaca3a81e7fbdc13f.apk",
            "https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://lf6-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://lf9-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://file.ljcdn.com/saas-pkg/asaas-new/new_asaas_4.0.56_win_prod.zip",
            "https://video19.ifeng.com/video09/2022/07/06/p6950362006465552946-102-162611.mp4",
            "https://download.jr.jd.com/downapp/jrapp_jr9631.apk"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 360云 CDN (6个下载源，随机选取) ──
    "cdn-360": {
        id: "cdn-360",
        name: "360云 CDN",
        downloadUrls: [
            "https://cdn.qq.ime.sogou.com/QQPinyin_Setup_6.6.6304.400.exe",
            "http://softdlc.360tpcdn.com/auto/20201130/2000000064_f07aefc3d918ebdafa9418f3f5ef5f9c.exe",
            "https://dldir1.qq.com/qqtv/TencentVideo11.99.8523.0.exe",
            "http://softdlc.360tpcdn.com/auto/20201127/23_21ed487ededbbb428b2a7dcecc969c7c.exe",
            "https://download.cntv.cn/cbox/v6/ysyy_v6.0.3.3_1001_setup_x64.exe?spm=0.PF8WgFTOZypm.ETms2K8Lsimc.6&file=ysyy_v6.0.3.3_1001_setup_x64.exe",
            "http://softdlc.360tpcdn.com/auto/20201127/100101123_879baf4f2d9d14f191be2443e16504af.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20200826/104511_999095167454c21f770b31e8f080ebb7.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20210401/103779382_99dafefbd4193095a95fa713348fe6e7.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20201125/105005364_74cbde2c220e12dbd49b2c86e0ab2c6f.exe"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 腾讯云 CDN ──
    "cdn-tencent": {
        id: "cdn-tencent",
        name: "腾讯云 CDN",
        downloadUrls: [
            "http://webcdn.m.qq.com/speed/SpeedTestData.dat"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 20,
        downloadTime: 10,
        uploadTime: 10
    }
};

let ooklaServers;
let libreServers;
let cdnServers;

export const getLibreServers = () => {
    if (libreServers) return libreServers;

    let servers = {};
    if (fs.existsSync("./data/servers/librespeed.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/librespeed.json", "utf8"));
        } catch { }
    }

    // Merge CN education LibreSpeed nodes
    libreServers = { ...servers, ...LIBRE_CN_SERVERS };

    return libreServers;
}

export const getOoklaServers = () => {
    if (ooklaServers) return ooklaServers;

    let servers = {};
    if (fs.existsSync("./data/servers/ookla.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/ookla.json", "utf8"));
        } catch { }
    }

    // Merge CN Ookla nodes
    ooklaServers = { ...servers, ...OOKLA_CN_SERVERS };

    return ooklaServers;
}

export const getCdnServers = () => {
    if (cdnServers) return cdnServers;

    let servers = {};
    if (fs.existsSync("./data/servers/cdn.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/cdn.json", "utf8"));
        } catch { }
    }

    cdnServers = { ...servers, ...CDN_SERVERS };
    return cdnServers;
}

export const getByMode = (mode) => {
    if (mode === "ookla") return getOoklaServers();
    if (mode === "libre") return getLibreServers();
    if (mode === "cdn") return getCdnServers();
}
