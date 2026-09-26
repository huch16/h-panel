// functions/lib/wallpaper-fetcher.js
// 与外部壁纸 API 交互的共享逻辑：被 functions/api/wallpaper.js 复用。

const FETCH_TIMEOUT_MS = 8000;
const API_360_BASE = 'http://cdn.apc.360.cn/index.php';

function fetchWithTimeout(url) {
    return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

/**
 * 拉取 360 壁纸 API 的通用函数。
 * @param {string} queryString - 例如 "?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=36&start=0&count=8"
 * @returns {Promise<object>}
 */
export async function fetch360Api(queryString) {
    const res = await fetchWithTimeout(`${API_360_BASE}${queryString}`);
    if (!res.ok) {
        throw new Error(`360 wallpaper API responded ${res.status}`);
    }
    return res.json();
}

/**
 * 从 360 API 拿一张随机壁纸 URL（按 currentIndex 轮转）。
 * @returns {Promise<{url: string, nextIndex: number} | null>}
 */
export async function fetch360Wallpaper(cid, currentIndex) {
    const json = await fetch360Api(`?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${encodeURIComponent(cid)}&start=0&count=8`);
    if (json.errno !== "0" || !Array.isArray(json.data) || json.data.length === 0) {
        return null;
    }

    const nextIndex = (currentIndex + 1) % json.data.length;
    const targetUrl = json.data[nextIndex]?.url;
    if (!targetUrl) return null;

    return {
        url: targetUrl.replace('http://', 'https://'),
        nextIndex,
    };
}

/**
 * 从 peapix Bing/spotlight feed 拉取随机壁纸 URL。
 * @returns {Promise<{url: string, nextIndex: number} | null>}
 */
export async function fetchBingWallpaper(bingCountry, currentIndex) {
    const url = bingCountry === 'spotlight'
        ? 'https://peapix.com/spotlight/feed?n=7'
        : `https://peapix.com/bing/feed?n=7&country=${encodeURIComponent(bingCountry)}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const nextIndex = (currentIndex + 1) % data.length;
    const targetItem = data[nextIndex];
    const targetUrl = targetItem?.fullUrl || targetItem?.url;
    if (!targetUrl) return null;

    return { url: targetUrl, nextIndex };
}

/**
 * 兼容旧调用方：根据 source/cid/country 选择 360 或 Bing 拉取单张壁纸。
 */
export async function fetchRandomWallpaper({ wallpaperSource, wallpaperCid360, bingCountry, currentWallpaperIndex }) {
    try {
        if (wallpaperSource === '360') {
            return await fetch360Wallpaper(wallpaperCid360 || '36', currentWallpaperIndex);
        }
        return await fetchBingWallpaper(bingCountry, currentWallpaperIndex);
    } catch (e) {
        console.error('Random Wallpaper Error:', e);
        return null;
    }
}