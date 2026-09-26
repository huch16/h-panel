// functions/api/admin/cleanup-logos.js
//
// 一次性端点：扫描所有 bookmarks，凡是 logo URL 实际返回"透明占位"
// （图片字节数 < threshold，默认 500B）的，就把 D1 中 logo 字段置 NULL。
//
// 调用方式（前端先登录后台拿到 session cookie + csrf token）：
//   POST /api/admin/cleanup-logos
//   Headers: Cookie: admin_session=...; X-CSRF-Token: ...
//   Body (可选): { "dryRun": true, "threshold": 500 }
//
// 安全：与所有 /api/* 写接口一样，受 _middleware.js 的 CSRF 校验保护；
// 另外内部仍显式调用 isAdminAuthenticated 二次校验。

import { isAdminAuthenticated, jsonResponse, errorResponse } from '../../_middleware';
import { sanitizeUrl } from '../../lib/utils';
import { HOME_CACHE_VERSION } from '../../constants';

const DEFAULT_THRESHOLD_BYTES = 500;  // 1x1 透明 PNG 通常 67-70 字节
const DEFAULT_TIMEOUT_MS = 6000;        // 单个 favicon 请求超时
const DEFAULT_CONCURRENCY = 8;          // 并发请求数
const MAX_LOGO_LENGTH = 200000;         // 与 INPUT_LIMITS.bookmarkLogo 一致

function buildFaviconProbe(url) {
  // 与 buildFaviconUrl 保持一致：用 host 部分喂给 faviconsnap
  if (!url) return null;
  if (url.startsWith('data:image')) return null;  // base64 内嵌图不参与扫描
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // 若是 faviconsnap 类代理 URL，原样探测；否则我们也按 host 探测
    if (url.includes('faviconsnap.com/api/favicon')) return url;
    return `https://faviconsnap.com/api/favicon?url=${encodeURIComponent(parsed.host)}`;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 一些 favicon 服务会根据 UA 拒绝；伪装成常见浏览器
        'User-Agent': 'Mozilla/5.0 (compatible; h-panel-cleanup/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function isPlaceholderResponse(response, contentLength, threshold) {
  // 1. 非 2xx → 视作不可用
  if (!response || !response.ok) return { placeholder: true, reason: `http_${response?.status || 'error'}` };

  const ct = response.headers.get('content-type') || '';
  // 2. 非图像响应 → 视为不可用
  if (!ct.startsWith('image/')) return { placeholder: true, reason: 'non_image' };

  // 3. 字节数判定（最可靠）：透明 1×1 PNG / ICO 通常 < 200 字节
  if (typeof contentLength === 'number' && contentLength > 0) {
    if (contentLength < threshold) {
      return { placeholder: true, reason: `size_${contentLength}B` };
    }
    // 命中常规尺寸 → 不是占位
    return { placeholder: false, reason: `size_${contentLength}B` };
  }

  // 4. content-length 缺失时退而求其次：用响应 status + content-type 决定
  //    （绝大多数 favicon 服务会回 content-length）
  return { placeholder: false, reason: 'no_content_length' };
}

async function classifyLogo(env, logo, threshold) {
  const probeUrl = buildFaviconProbe(logo);
  if (!probeUrl) return { placeholder: true, reason: 'invalid_url' };

  try {
    const response = await fetchWithTimeout(probeUrl, DEFAULT_TIMEOUT_MS);
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
    return isPlaceholderResponse(response, contentLength, threshold);
  } catch (e) {
    return { placeholder: true, reason: `fetch_error_${e?.name || 'unknown'}` };
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await mapper(items[idx], idx);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  let body = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const dryRun = body.dryRun !== false; // 默认 dryRun=true（安全）
  const threshold = Number.isFinite(Number(body.threshold)) && Number(body.threshold) > 0
    ? Number(body.threshold)
    : DEFAULT_THRESHOLD_BYTES;

  // 1. 拉取所有带 logo 的书签
  let rows;
  try {
    const result = await env.NAV_DB.prepare(
      'SELECT id, name, url, logo FROM sites WHERE logo IS NOT NULL AND logo != "" ORDER BY id ASC'
    ).all();
    rows = result.results || [];
  } catch (e) {
    return errorResponse(`Failed to query sites: ${e.message}`, 500);
  }

  // 2. 并发探测
  const classifications = await mapWithConcurrency(rows, DEFAULT_CONCURRENCY, async (row) => {
    const result = await classifyLogo(env, row.logo, threshold);
    return { row, ...result };
  });

  // 3. 汇总
  const summary = {
    total: rows.length,
    scanned: classifications.length,
    cleaned: 0,
    kept: 0,
    errors: 0,
    dryRun,
    threshold,
    items: [],
  };

  const toClean = [];
  for (const c of classifications) {
    if (c.placeholder) {
      summary.cleaned++;
      toClean.push(c.row.id);
      summary.items.push({ id: c.row.id, name: c.row.name, action: 'clear', reason: c.reason });
    } else {
      summary.kept++;
      summary.items.push({ id: c.row.id, name: c.row.name, action: 'keep', reason: c.reason });
    }
  }

  // 4. 实际更新（除非 dryRun）
  if (!dryRun && toClean.length > 0) {
    try {
      // D1 单条 UPDATE 比批量 IN(?) 在大量 ID 时更可控；分批 50 一组
      const BATCH = 50;
      for (let i = 0; i < toClean.length; i += BATCH) {
        const slice = toClean.slice(i, i + BATCH);
        const stmt = env.NAV_DB.prepare('UPDATE sites SET logo = NULL WHERE id = ?');
        const batch = slice.map(id => stmt.bind(id));
        await env.NAV_DB.batch(batch);
      }
    } catch (e) {
      summary.errors++;
      return errorResponse(`Failed to clear logos: ${e.message}`, 500);
    }
  }

  // 5. 主动失效首页缓存，让下次访问拿到新数据
  try {
    const stmt = env.NAV_AUTH.prepare(
      `DELETE FROM home_dirty_public_${HOME_CACHE_VERSION}`
    );
    await stmt.run();
  } catch (e) {
    // 静默：缓存未命中也不致命
  }

  return jsonResponse({
    code: 200,
    message: dryRun
      ? `Dry-run complete. ${summary.cleaned} bookmark(s) would have logo cleared.`
      : `Cleanup complete. ${summary.cleaned} bookmark(s) had logo cleared.`,
    data: summary,
  });
}

// GET 仅用于查看当前任务状态（不执行扫描，避免误用）
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }
  return jsonResponse({
    code: 200,
    data: {
      endpoint: 'POST /api/admin/cleanup-logos',
      params: { dryRun: 'boolean (default true)', threshold: 'bytes (default 500)' },
      note: '此端点扫描所有非空 logo，HEAD 检查响应字节数；< threshold 视为透明占位并清空。',
    },
  });
}