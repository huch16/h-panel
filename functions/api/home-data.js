// functions/api/home-data.js
// 单一数据源：返回首页所需全部数据（替代 SSR + 模板占位符）
// 客户端 home-render.js 拉取此 API 后渲染

import { getSettingsKeys, parseSettings } from '../lib/settings-parser';
import { buildCardHydrationState } from '../lib/card-model';
import { resolveWallpaperUrl } from '../lib/wallpaper-defaults';
import { getSessionToken, isAdminAuthenticated } from '../_middleware';
import { FONT_MAP } from '../constants';

function normalizeCssPixelValue(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/[^0-9]/g, '');
  return normalized === '' ? String(fallback) : normalized;
}

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCategoryTree(rawCategories) {
  const map = new Map();
  const idMap = new Map();
  const roots = [];
  rawCategories.forEach(cat => {
    cat.children = [];
    if (cat.catelog) idMap.set(cat.catelog, cat.id);
    map.set(cat.id, cat);
  });
  rawCategories.forEach(cat => {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  });
  const sort = (cats) => {
    cats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.id || 0) - (b.id || 0));
    cats.forEach(c => sort(c.children));
  };
  sort(roots);
  return roots;
}

function getUsedFonts(S) {
  const used = new Set();
  const add = (flag, font) => { if (flag && font) used.add(font); };
  add(!S.layout_hide_title && S.home_title_font);
  add(!S.layout_hide_subtitle && S.home_subtitle_font);
  add(!S.home_hide_stats && S.home_stats_font);
  add(!S.home_hide_hitokoto && S.home_hitokoto_font);
  add(S.card_title_font);
  add(S.card_desc_font);
  add(S.mobile_card_title_font);
  add(S.mobile_card_desc_font);
  return Array.from(used);
}

function buildCustomCardCss(S) {
  const styles = [];
  const dt = `${S.card_title_size ? `font-size:${S.card_title_size}px;` : ''}${S.card_title_color ? `color:${S.card_title_color};` : ''}${S.card_title_font ? `font-family:${S.card_title_font};` : ''}`.trim();
  const mt = `${S.mobile_card_title_size ? `font-size:${S.mobile_card_title_size}px;` : ''}${S.mobile_card_title_color ? `color:${S.mobile_card_title_color};` : ''}${S.mobile_card_title_font ? `font-family:${S.mobile_card_title_font};` : ''}`.trim();
  const dd = `${S.card_desc_size ? `font-size:${S.card_desc_size}px;` : ''}${S.card_desc_color ? `color:${S.card_desc_color};` : ''}${S.card_desc_font ? `font-family:${S.card_desc_font};` : ''}`.trim();
  const md = `${S.mobile_card_desc_size ? `font-size:${S.mobile_card_desc_size}px;` : ''}${S.mobile_card_desc_color ? `color:${S.mobile_card_desc_color};` : ''}${S.mobile_card_desc_font ? `font-family:${S.mobile_card_desc_font};` : ''}`.trim();
  if (dt) styles.push(`@media (min-width: 768px){.site-title{${dt}}}`);
  if (mt) styles.push(`@media (max-width: 767px){.site-title{${mt}}}`);
  if (dd) styles.push(`@media (min-width: 768px){.site-card p{${dd}}}`);
  if (md) styles.push(`@media (max-width: 767px){.site-card p{${md}}}`);
  return styles.join('');
}

function buildHeadInjections(data) {
  const { settings: S, usedFonts, customFontUrl, styles, isCustomWallpaper, resolvedWallpaperUrl, iconApi } = data;
  const cssVars = `:root{--card-padding:1.25rem;--card-radius:${styles.cardRadius}px;--frosted-glass-blur:${styles.frostedBlur}px}@media (max-width:767px){:root{--card-radius:${styles.mobileCardRadius}px;--frosted-glass-blur:${styles.mobileFrostedBlur}px}}`;
  const customCardCss = buildCustomCardCss(S);
  const fontLinks = usedFonts
    .filter(f => FONT_MAP[f])
    .map(f => `<link rel="stylesheet" href="${escapeHTML(FONT_MAP[f])}">`)
    .join('');
  const customFontLink = customFontUrl
    ? `<link rel="stylesheet" href="${escapeHTML(customFontUrl)}">`
    : '';
  const preconnectFonts = usedFonts.length > 0
    ? `<link rel="preconnect" href="https://fonts.loli.net" crossorigin>`
    : '';
  const preconnectIcon = iconApi
    ? (() => { try { return `<link rel="preconnect" href="${escapeHTML(new URL(iconApi).origin)}" crossorigin>`; } catch { return ''; } })()
    : '';
  const preloadWallpaper = isCustomWallpaper && resolvedWallpaperUrl
    ? `<link rel="preload" as="image" href="${escapeHTML(resolvedWallpaperUrl)}">`
    : '';
  const hideAdminCss = S.home_hide_admin
    ? '<style>a[href^="/admin"]{display:none!important}</style>'
    : '';

  return {
    cssVars,
    customCardCss,
    fontLinks,
    customFontLink,
    preconnectFonts,
    preconnectIcon,
    preloadWallpaper,
    hideAdminCss,
  };
}

function getThemeClasses(isCustomWallpaper) {
  return isCustomWallpaper ? {
    headerClass: 'bg-transparent border-none shadow-none transition-colors duration-300',
    containerClass: 'rounded-2xl',
    titleColorClass: 'text-gray-900 dark:text-gray-100',
    subTextColorClass: 'text-gray-600 dark:text-gray-300',
    searchInputClass: 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-200 dark:focus:bg-gray-800',
    searchIconClass: 'text-gray-400 dark:text-gray-500',
  } : {
    headerClass: 'bg-primary-700 text-white border-b border-primary-600 shadow-sm dark:bg-gray-900 dark:border-gray-800',
    containerClass: 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm dark:bg-gray-800/80 dark:border-gray-700',
    titleColorClass: 'text-white',
    subTextColorClass: 'text-primary-100/90 dark:text-gray-400',
    searchInputClass: 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder-gray-500',
    searchIconClass: 'text-primary-200 dark:text-gray-500',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;
  const requestedCatalogValue = (url.searchParams.get('catalog') || '').trim();

  // === 1. 并行查询 ===
  const categoryQuery = isAuthenticated
    ? 'SELECT id, catelog, sort_order, parent_id, is_private FROM category ORDER BY sort_order ASC, id ASC'
    : 'SELECT id, catelog, sort_order, parent_id FROM category WHERE is_private = 0 ORDER BY sort_order ASC, id ASC';

  const settingsKeys = getSettingsKeys();
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');
  const sitesQuery = `SELECT id, name, url, logo, desc, catelog_id, catelog_name
                      FROM sites WHERE (is_private = 0 OR ? = 1) ORDER BY sort_order ASC, create_time DESC`;

  // Settings KV 缓存层（与原 SSR 保持一致）
  const settingsCacheKey = 'settings_cache';
  const fetchSettings = async () => {
    try {
      const cached = await env.NAV_AUTH.get(settingsCacheKey, { type: 'json' });
      if (cached) return cached;
    } catch (e) { /* KV miss/error 时回退 D1 */ }
    const result = await env.NAV_DB.prepare(
      `SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`
    ).bind(...settingsKeys).all();
    if (result.results && env.NAV_AUTH) {
      context.waitUntil(env.NAV_AUTH.put(settingsCacheKey, JSON.stringify(result.results), { expirationTtl: 86400 }));
    }
    return result.results || [];
  };

  const [categoriesResult, settingsRows, sitesResult] = await Promise.all([
    env.NAV_DB.prepare(categoryQuery).all().catch(e => ({ results: [], error: e })),
    fetchSettings().catch(e => []),
    env.NAV_DB.prepare(sitesQuery).bind(includePrivate).all().catch(e => ({ results: [], error: e })),
  ]);

  // === 2. 处理分类树 ===
  const rawCategories = categoriesResult.results || [];
  const rootCategories = buildCategoryTree(rawCategories);
  const categoryMap = new Map(rawCategories.map(c => [c.id, c]));
  const categoryIdMap = new Map(rawCategories.filter(c => c.catelog).map(c => [c.catelog, c.id]));

  // === 3. 解析设置 ===
  const S = parseSettings(settingsRows);

  // === 4. 处理站点 + 分类筛选 ===
  const allSites = sitesResult.results || [];
  const resolveCatalogId = (val, opts = {}) => {
    const v = String(val || '').trim();
    if (!v || v.toLowerCase() === 'all') return null;
    if (/^\d+$/.test(v)) {
      const id = Number(v);
      if (categoryMap.has(id)) return id;
    }
    return opts.allowName && categoryIdMap.has(v) ? categoryIdMap.get(v) : null;
  };

  let resolvedCatalogId = resolveCatalogId(requestedCatalogValue);
  if (!requestedCatalogValue) {
    const defaultCat = (S.home_default_category || '').trim();
    resolvedCatalogId = resolveCatalogId(defaultCat, { allowName: true });
  }

  let currentCatalogName = '';
  let targetCategoryIds = [];
  const catalogExists = resolvedCatalogId !== null;
  if (catalogExists) {
    currentCatalogName = categoryMap.get(resolvedCatalogId)?.catelog || '';
    targetCategoryIds = [resolvedCatalogId];
  }

  const filteredSites = targetCategoryIds.length > 0
    ? allSites.filter(s => targetCategoryIds.includes(s.catelog_id))
    : allSites;

  // === 5. 卡片 hydration state ===
  const cardState = buildCardHydrationState(filteredSites, S);

  // === 6. 壁纸与主题 ===
  const resolvedWallpaperUrl = resolveWallpaperUrl(S.layout_custom_wallpaper, S.layout_card_style);
  const isCustomWallpaper = Boolean(resolvedWallpaperUrl);
  const theme = getThemeClasses(isCustomWallpaper);

  // === 7. SEO/Footer ===
  const siteName = S.home_site_name || env.SITE_NAME || '湖海的自由天空';
  const siteDescription = S.home_site_description || env.SITE_DESCRIPTION || '有轨电车旁的苦菊';
  const footerText = S.home_footer_text || env.FOOTER_TEXT || '曾梦想仗剑走天涯';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';

  // === 8. CSRF token (admin) ===
  let csrf = '';
  if (isAuthenticated) {
    const sessionToken = getSessionToken(request);
    if (sessionToken) {
      try {
        csrf = (await env.NAV_AUTH.get(`csrf_${sessionToken}`)) || '';
      } catch {}
    }
  }

  // === 9. Head injections (CSS vars, fonts, preload, custom CSS) ===
  const head = buildHeadInjections({
    settings: S,
    usedFonts: getUsedFonts(S),
    customFontUrl: S.home_custom_font_url || '',
    styles: {
      cardRadius: normalizeCssPixelValue(S.layout_card_border_radius, 12),
      mobileCardRadius: normalizeCssPixelValue(S.mobile_layout_card_border_radius, 12),
      frostedBlur: normalizeCssPixelValue(S.layout_frosted_glass_intensity, 15),
      mobileFrostedBlur: normalizeCssPixelValue(S.mobile_layout_frosted_glass_intensity, 15),
    },
    isCustomWallpaper,
    resolvedWallpaperUrl,
    iconApi: env.ICON_API || '',
  });

  // === 10. 响应 ===
  const payload = {
    isAuthenticated,
    csrf,
    siteName,
    siteDescription,
    footerText,
    currentYear: new Date().getFullYear(),
    submissionEnabled,
    isCustomWallpaper,
    resolvedWallpaperUrl,
    theme,
    currentCatalogName,
    currentCatalogId: resolvedCatalogId,
    catalogExists,
    settings: S,
    categories: rootCategories,
    sites: cardState.cards,
    cardState: {
      config: cardState.config,
      configs: cardState.configs,
    },
    layout: {
      hideDesc: S.layout_hide_desc,
      hideLinks: S.layout_hide_links,
      hideCategory: S.layout_hide_category,
      gridCols: S.layout_grid_cols,
      cardStyle: S.layout_card_style,
      cardAnimation: S.layout_card_animation,
      enableFrostedGlass: S.layout_enable_frosted_glass,
      rememberLastCategory: S.home_remember_last_category,
      ssrCatalogId: catalogExists ? resolvedCatalogId : 'all',
    },
    head,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': isAuthenticated
        ? 'private, no-store, max-age=0'
        : 'public, max-age=60, must-revalidate',
    },
  });
}