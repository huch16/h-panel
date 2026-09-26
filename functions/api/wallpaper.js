// functions/api/wallpaper.js
// 壁纸 HTTP 端点：复用 functions/lib/wallpaper-fetcher.js。

import { jsonResponse, errorResponse } from '../_middleware';
import { fetch360Api, fetch360Wallpaper, fetchBingWallpaper } from '../lib/wallpaper-fetcher';

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'bing';
  const action = url.searchParams.get('action') || '';
  const cid = url.searchParams.get('cid') || '36';
  const country = url.searchParams.get('country') || '';
  const indexStr = url.searchParams.get('index') || '-1';
  const currentIndex = Number.isFinite(parseInt(indexStr, 10)) ? parseInt(indexStr, 10) : -1;

  try {
    // 360 壁纸：分类列表
    if (source === '360' && action === 'categories') {
      const json = await fetch360Api('?c=WallPaper&a=getAllCategoriesV2&from=360chrome');
      return jsonResponse({ code: 200, data: json });
    }

    // 360 壁纸：壁纸列表
    if (source === '360' && action === 'list') {
      const start = url.searchParams.get('start') || '0';
      const count = url.searchParams.get('count') || '8';
      const json = await fetch360Api(
        `?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${encodeURIComponent(cid)}&start=${encodeURIComponent(start)}&count=${encodeURIComponent(count)}`
      );
      return jsonResponse({ code: 200, data: json });
    }

    // 默认行为：获取单张壁纸（首页 SSR 和客户端随机壁纸使用）
    let targetUrl = '';
    let nextIndex = 0;

    if (source === '360') {
      const item = await fetch360Wallpaper(cid, currentIndex);
      if (item) {
        targetUrl = item.url;
        nextIndex = item.nextIndex;
      }
    } else {
      const item = await fetchBingWallpaper(country, currentIndex);
      if (item) {
        targetUrl = item.url;
        nextIndex = item.nextIndex;
      }
    }

    if (targetUrl) {
      return jsonResponse({ code: 200, data: { url: targetUrl, index: nextIndex } });
    }
    return errorResponse('Failed to fetch wallpaper', 502);
  } catch (e) {
    console.error('Wallpaper API error:', e);
    return errorResponse(`Error: ${e.message}`, 500);
  }
}