/* =========================================================================
 * home-render.js
 * 纯客户端首页渲染器 - 完全替代 functions/index.js 的 SSR + 模板占位符
 *
 * 数据流：fetch /api/home-data → 模板生成 → innerHTML 注入
 * ========================================================================= */
(function () {
  'use strict';

  const APP_ROOT_ID = 'app';
  const API_PATH = '/api/home-data';

  // ====================== 工具函数 ======================
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const sanitizeUrl = (url) => {
    if (!url) return '';
    const s = String(url).trim();
    return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : '';
  };

  // ====================== 样式辅助 ======================
  function getStyleStr(size, color, font) {
    const parts = [];
    if (size) parts.push(`font-size:${size}px`);
    if (color) parts.push(`color:${color}`);
    if (font) parts.push(`font-family:'${font}'`);
    return parts.length ? `style="${parts.join(';')}"` : '';
  }

  // ====================== 分类位置归一 ======================
  function normalizeCategoryPosition(pos, menuLayout) {
    if (pos === 'above_description') return 'top';
    if (['below_search', 'above_search', 'left', 'top'].includes(pos)) return pos;
    return menuLayout === 'vertical' ? 'left' : 'below_search';
  }

  // ====================== 模板：水平/垂直导航 ======================
  function renderHorizontalItems(cats, currentCatalogName, level = 0) {
    return cats.map(cat => {
      const isActive = currentCatalogName === cat.catelog;
      const hasChildren = cat.children && cat.children.length > 0;
      const isRoot = level === 0;
      const activeClass = isActive ? 'active' : (isRoot ? 'inactive' : '');
      const navItemActive = isActive ? 'nav-item-active' : '';
      const wrapperClass = isRoot ? 'menu-item-wrapper relative inline-block text-left' : 'menu-item-wrapper relative block w-full';
      const linkClass = isRoot ? `nav-btn ${activeClass} ${navItemActive}` : `dropdown-item ${activeClass} ${navItemActive}`;
      const arrowSvg = hasChildren
        ? (isRoot
          ? '<svg class="w-3 h-3 ml-1 opacity-70"><use href="#icon-chevron-down"/></svg>'
          : '<svg class="dropdown-arrow-icon"><use href="#icon-chevron-right"/></svg>')
        : '';
      const childrenHtml = hasChildren
        ? `<div class="dropdown-menu">${renderHorizontalItems(cat.children, currentCatalogName, level + 1)}</div>`
        : '';
      return `<div class="${wrapperClass}"><a href="?catalog=${encodeURIComponent(cat.id)}" class="${linkClass}" data-id="${cat.id}">${esc(cat.catelog)}${arrowSvg}</a>${childrenHtml}</div>`;
    }).join('');
  }

  function renderVerticalItems(cats, currentCatalogName, isCustomWallpaper, level = 0) {
    return cats.map(cat => {
      const isActive = currentCatalogName === cat.catelog;
      const baseClass = 'flex items-center px-3 py-2 rounded-lg w-full transition-colors duration-200';
      const activeClass = isActive
        ? 'bg-secondary-100 text-primary-700 dark:bg-gray-800 dark:text-primary-400'
        : 'hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';
      const iconClass = isActive ? 'text-primary-600 dark:text-primary-400' : (isCustomWallpaper ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500');
      const indent = level * 12;
      let html = `<a href="?catalog=${encodeURIComponent(cat.id)}" data-id="${cat.id}" class="${baseClass} ${activeClass}" style="padding-left: ${12 + indent}px">
        <svg class="h-5 w-5 mr-2 ${iconClass}"><use href="#icon-folder"/></svg>
        ${esc(cat.catelog)}
      </a>`;
      if (cat.children?.length) html += renderVerticalItems(cat.children, currentCatalogName, isCustomWallpaper, level + 1);
      return html;
    }).join('');
  }

  // ====================== 模板：卡片 ======================
  function renderSiteCards(sites, settings) {
    if (!sites.length) return '';
    const config = window.HomeCardModel.buildCardTemplateConfig(settings, 'desktop');
    return sites.map((card, index) => {
      const isAboveFold = index < config.aboveFoldImageCount;
      const imgAttrs = isAboveFold ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
      const descHtml = config.hideDesc ? '' : `<p class="${config.descClass}" title="${card.descHtml}">${card.descHtml}</p>`;
      const linksHtml = config.hideLinks ? '' : `
        <div class="${config.linkRowClass}">
          <span class="${config.urlTextClass}" title="${card.displayUrlHtml}">${card.displayUrlHtml}</span>
          <button class="${config.copyButtonBaseClass} ${card.hasValidUrl ? config.copyButtonEnabledClass : config.copyButtonDisabledClass}" data-url="${card.urlHtml}" ${card.hasValidUrl ? '' : 'disabled'}>
            <svg class="h-3 w-3 ${config.hideCopyText ? '' : 'mr-1'}"><use href="#icon-copy"/></svg>
            ${config.hideCopyText ? '' : '<span class="copy-text">复制</span>'}
            <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
          </button>
        </div>`;
      const categoryHtml = config.hideCategory ? '' : `<span class="${config.categoryClass}">${card.catalogHtml}</span>`;
      const logo = card.logoUrlHtml
        ? `<img src="${card.logoUrlHtml}" alt="${card.nameHtml}" width="40" height="40" class="${config.logoClass}" ${imgAttrs}>`
        : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${card.cardInitialHtml}</div>`;
      return `
        <div class="${config.baseCardClass} ${config.frostedClass} ${config.cardStyleClass} card-anim-enter" data-id="${card.id}">
          <div class="site-card-content">
            <a href="${card.urlHtml || '#'}" ${card.hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
              <div class="flex items-start">
                <div class="${config.siteIconClass}">${logo}</div>
                <div class="flex-1 min-w-0">
                  <h3 class="${config.titleClass}" title="${card.nameHtml}">${card.nameHtml}</h3>
                  ${categoryHtml}
                </div>
              </div>
              ${descHtml}
            </a>
            ${linksHtml}
          </div>
        </div>`;
    }).join('');
  }

  function renderEmptyState(categoryCount, hideAdmin) {
    const emptyText = '暂无书签';
    const emptySub = categoryCount === 0
      ? '快去添加第一个分类和书签吧。'
      : '该分类下还没有添加任何书签。';
    return `
      <div class="col-span-full flex flex-col items-center justify-center py-10 sm:py-12 text-center animate-fade-in">
        <div class="w-14 h-14 sm:w-16 sm:h-16 mb-3 text-gray-200 dark:text-gray-700/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.25" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-600 dark:text-gray-300 mb-1">${emptyText}</h3>
        <p class="text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto mb-5">${emptySub}</p>
        ${!hideAdmin ? `<a href="/admin" target="_blank" class="inline-flex items-center px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 hover:-translate-y-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>前往管理后台
        </a>` : ''}
      </div>`;
  }

  // ====================== 模板：左侧/右侧操作 ======================
  function renderLeftTopAction(visible) {
    if (!visible) return '';
    return `<div class="fixed top-4 left-4 z-50 lg:hidden">
      <button id="sidebarToggle" class="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </div>`;
  }

  function renderRightTopActions(showAdmin) {
    return `<div class="fixed top-4 right-4 z-50 flex items-center gap-3">
      <button id="themeToggleBtn" class="top-action-icon theme-action-icon" title="切换主题">
        <svg id="themeIconSun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block dark:hidden"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
        <svg id="themeIconMoon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </button>
      ${showAdmin ? `<a href="/admin" target="_blank" class="top-action-icon admin-action-icon" title="后台管理">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 18a5 5 0 0 1 10 0"/></svg>
      </a>` : ''}
    </div>`;
  }

  // ====================== 模板：移动端遮罩 ======================
  function renderMobileOverlay() {
    return `<div id="mobileOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 mobile-overlay lg:hidden"></div>`;
  }

  // ====================== 模板：桌面侧栏开关 ======================
  function renderSidebarToggle(show) {
    if (!show) return '';
    return `<div class="fixed top-4 left-4 z-50 hidden lg:block">
      <label for="sidebar-toggle" class="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100 inline-block cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </label>
    </div>`;
  }

  // ====================== 模板：侧边栏 ======================
  function renderSidebar(data) {
    const cats = data.categories;
    const isCustom = data.isCustomWallpaper;
    const currentName = data.currentCatalogName;
    const allActive = !data.catalogExists;
    const allClass = allActive ? 'active' : 'inactive';
    const allMarker = allActive ? 'nav-item-active' : '';

    return `<aside id="sidebar" class="sidebar fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-md border-r border-primary-100/60 dark:border-gray-800 z-50 overflow-y-auto mobile-sidebar lg:transform-none transition-all duration-300 ${data.layout._sidebarClass}">
      <div class="p-6">
        <div class="flex items-center justify-end mb-8">
          <button id="closeSidebar" class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <label for="sidebar-toggle" class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hidden lg:block cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </label>
        </div>
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">分类导航</h3>
          <div class="space-y-1">
            <a href="?catalog=all" class="flex items-center px-3 py-2 rounded-lg ${allClass ? 'active' : 'inactive'} ${allMarker} w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span class="text-gray-700 dark:text-gray-200">全部</span>
            </a>
            ${renderVerticalItems(cats, currentName, isCustom, 0)}
          </div>
        </div>
        <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div class="${data.submissionEnabled ? '' : '!hidden'}">
            <button id="addSiteBtnSidebar" class="w-full flex items-center justify-center px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition duration-300 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>添加新书签
            </button>
          </div>
          ${data.settings.home_hide_admin ? '' : `<a href="/admin" target="_blank" class="mt-2 flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            后台管理
          </a>`}
        </div>
      </div>
    </aside>`;
  }

  // ====================== 模板：Header (含搜索 + 分类导航) ======================
  function renderHeader(data) {
    const { settings: S, theme, isCustomWallpaper, currentCatalogName, catalogExists, categories } = data;
    const isHorizontalLayout = data.layout._categoryPosition !== 'left';

    const allActive = !catalogExists;
    const allClass = allActive ? 'active' : 'inactive';
    const allMarker = allActive ? 'nav-item-active' : '';
    const horizontalAllLink = `<div class="menu-item-wrapper relative inline-block text-left">
      <a href="?catalog=all" class="nav-btn ${allClass} ${allMarker}">全部</a>
    </div>`;
    const horizontalCatalogs = horizontalAllLink + renderHorizontalItems(categories, currentCatalogName);

    const catPos = data.layout._categoryPosition;
    const catFlow = data.layout._categoryFlow;
    const navShellClass = catPos === 'top'
      ? 'horizontal-category-nav-shell is-top relative mx-auto'
      : 'horizontal-category-nav-shell relative mx-auto';
    const navJustifyClass = catFlow === 'multi_line' ? 'justify-start' : 'justify-center';
    const navWrapClass = catFlow === 'multi_line' ? 'flex-wrap' : 'flex-nowrap';
    const navFlowClass = catFlow === 'multi_line' ? 'is-multi-line' : 'is-single-line';
    const moreHtml = catFlow === 'multi_line' ? '' : `
      <div id="horizontalMoreWrapper" class="relative hidden">
        <button id="horizontalMoreBtn" class="nav-btn inactive">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
        </button>
        <div id="horizontalMoreDropdown" class="dropdown-menu hidden absolute mt-2 w-auto z-50"></div>
      </div>`;
    const horizontalNavHtml = `
      <div class="${navShellClass}">
        <div id="horizontalCategoryNav" class="flex ${navWrapClass} ${navJustifyClass} items-center gap-3 overflow-visible ${navFlowClass} transition-all duration-300">
          ${horizontalCatalogs}
          ${moreHtml}
        </div>
      </div>`;

    const safeSiteName = esc(S.home_site_name || data.siteName);
    const safeSiteDesc = esc(S.home_site_description || data.siteDescription);
    const titleStyle = getStyleStr(S.home_title_size, S.home_title_color, S.home_title_font);
    const subStyle = getStyleStr(S.home_subtitle_size, S.home_subtitle_color, S.home_subtitle_font);
    const titleHtml = S.layout_hide_title ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${theme.titleColorClass}" ${titleStyle}>${safeSiteName}</h1>`;
    const subHtml = S.layout_hide_subtitle ? '' : `<p class="${theme.subTextColorClass} opacity-90 text-sm md:text-base" ${subStyle}>${safeSiteDesc}</p>`;

    const engineOptions = S.home_search_engine_enabled ? `
      <div class="flex justify-center items-center gap-3 mb-4 text-sm select-none search-engine-wrapper">
        <label class="search-engine-option active" data-engine="local"><span>站内</span></label>
        <label class="search-engine-option" data-engine="google"><span>Google</span></label>
        <label class="search-engine-option" data-engine="baidu"><span>Baidu</span></label>
        <label class="search-engine-option" data-engine="github"><span>Github</span></label>
      </div>` : '';

    const themeCls = isCustomWallpaper ? 'custom-wallpaper' : '';
    const verticalHeader = `
      <div class="max-w-4xl mx-auto text-center relative z-10 ${themeCls} py-8">
        <div class="home-title-block mb-8">${titleHtml}${subHtml}</div>
        <div class="home-search-shell relative max-w-xl mx-auto">
          ${engineOptions}
          <div class="home-search-field relative">
            <input type="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${theme.searchInputClass}" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="search" enterkeyhint="search" aria-label="搜索书签" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
            <svg xmlns="http://www.w3.org/2000/svg" class="home-search-icon h-6 w-6 absolute left-4 top-3.5 ${theme.searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>`;

    const horizontalHeader = `
      <div class="max-w-5xl mx-auto text-center relative z-10 ${themeCls}">
        ${catPos === 'top' ? `<div class="category-nav-top-wrap">${horizontalNavHtml}</div>` : ''}
        <div class="home-title-block max-w-4xl mx-auto mb-8">${titleHtml}${subHtml}</div>
        ${catPos === 'above_search' ? `<div class="mb-8">${horizontalNavHtml}</div>` : ''}
        <div class="home-search-shell relative max-w-xl mx-auto ${catPos === 'below_search' ? 'mb-8' : ''}">
          ${engineOptions}
          <div class="home-search-field relative">
            <input id="headerSearchInput" type="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${theme.searchInputClass}" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="search" enterkeyhint="search" aria-label="搜索书签" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
            <svg xmlns="http://www.w3.org/2000/svg" class="home-search-icon h-6 w-6 absolute left-4 top-3.5 ${theme.searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        ${catPos === 'below_search' ? horizontalNavHtml : ''}
      </div>`;

    if (isHorizontalLayout) {
      return `<header class="${theme.headerClass} text-white py-10 px-6 md:px-10 shadow-sm">
        <div class="min-[550px]:hidden">${verticalHeader}</div>
        <div class="hidden min-[550px]:block">${horizontalHeader}</div>
      </header>`;
    }
    return `<header class="${theme.headerClass} text-white py-10 px-6 md:px-10 shadow-sm">${verticalHeader}</header>`;
  }

  // ====================== 模板：统计行（标题 + 一言） ======================
  function renderStats(data) {
    const S = data.settings;
    const siteCount = data.sites.length;
    const headingPlain = data.currentCatalogName
      ? `${data.currentCatalogName} · ${siteCount} 个书签`
      : `全部收藏 · ${siteCount} 个书签`;
    const headingHtml = esc(headingPlain);
    const headingActive = data.catalogExists ? esc(data.currentCatalogName) : '';
    const hitokotoContent = S.home_hide_hitokoto ? '' : '疏影横斜水清浅,暗香浮动月黄昏。';
    const hitokotoClass = (data.isCustomWallpaper ? 'text-black dark:text-gray-200' : 'text-gray-500 dark:text-gray-400') + ' ml-auto';
    const hitokotoStyle = getStyleStr(S.home_hitokoto_size, S.home_hitokoto_color, S.home_hitokoto_font);
    const statsStyle = getStyleStr(S.home_stats_size, S.home_stats_color, S.home_stats_font);
    const statsRowPy = (!S.home_hide_stats || !S.home_hide_hitokoto) ? 'my-8' : 'hidden';
    const statsRowHidden = (!S.home_hide_stats || !S.home_hide_hitokoto) ? '' : 'hidden';

    return `<div class="home-stats-row max-w-7xl mx-auto px-4 sm:px-6 ${statsRowPy}">
      <div class="flex items-center justify-between ${statsRowHidden}">
        <h2 class="text-xl font-semibold text-gray-800 ${S.home_hide_stats ? 'hidden' : ''}" ${statsStyle} data-role="list-heading" data-default="${headingHtml}" data-active="${headingActive}">
          ${headingHtml}
        </h2>
        <div id="hitokoto-parent" class="text-sm ${S.home_hide_hitokoto ? 'hidden' : 'md:block'} ${hitokotoClass}" ${hitokotoStyle}>
          <div id="hitokoto"><a href="#" target="_blank" id="hitokoto_text" ${hitokotoStyle}>${hitokotoContent}</a></div>
        </div>
      </div>
    </div>`;
  }

  // ====================== 模板：站点网格 + 空状态 ======================
  function renderSitesSection(data) {
    const cardsHtml = data.sites.length > 0
      ? renderSiteCards(data.sites, data.settings)
      : renderEmptyState(data.categories.length, data.settings.home_hide_admin);
    return `<section class="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div class="${data.theme.containerClass} p-4 sm:p-6">
        <div id="sitesGrid" class="${data.layout._gridClass}">
          ${cardsHtml}
        </div>
      </div>
    </section>`;
  }

  // ====================== 模板：Footer + 背景层 ======================
  function renderFooter(data) {
    const footerClass = data.isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100 dark:bg-gray-900 dark:border-gray-800';
    return `<footer class="${footerClass}">
      <div class="max-w-7xl mx-auto text-center text-sm ${data.isCustomWallpaper ? 'text-gray-800' : 'text-gray-500 dark:text-gray-400'}">
        ${esc(data.footerText)}
        <span class="mx-2">·</span>
        © ${data.currentYear}
      </div>
    </footer>`;
  }

  function renderBackground(data) {
    if (data.resolvedWallpaperUrl && data.isCustomWallpaper) {
      const blur = data.settings.layout_enable_bg_blur
        ? `filter: blur(${data.settings.layout_bg_blur_intensity}px); transform: scale(1.02);`
        : '';
      return `<div id="fixed-background" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-9999;pointer-events:none;overflow:hidden;">
        <img src="${esc(data.resolvedWallpaperUrl)}" alt="" fetchpriority="high" style="width:100%;height:100%;object-fit:cover;${blur}">
      </div>`;
    }
    return `<div id="fixed-background" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-9999;pointer-events:none;background-color:#fdf8f3;"></div>`;
  }

  function renderFloatingButtons(data) {
    if (!data.submissionEnabled) {
      return `<button id="backToTop" class="fixed bottom-8 right-8 p-3 rounded-full bg-accent-500 text-white shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-accent-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
      </button>`;
    }
    return `<button id="backToTop" class="fixed bottom-8 right-8 p-3 rounded-full bg-accent-500 text-white shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-accent-600">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
    </button>
    <button type="button" id="addSiteBtnFloating" class="fixed bottom-24 right-8 z-40 hidden min-[550px]:flex p-3 rounded-full bg-accent-500 text-white shadow-lg hover:bg-accent-600 transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2" title="公开投稿" aria-label="公开投稿">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14" /></svg>
    </button>`;
  }

  // ====================== 模板：骨架屏 ======================
  function renderSkeleton() {
    const cards = Array.from({ length: 8 }, () => `
      <div class="home-skel-card">
        <div class="home-skel-logo"></div>
        <div class="flex-1 space-y-2">
          <div class="home-skel-line h-4 w-2/3"></div>
          <div class="home-skel-line h-3 w-1/2"></div>
        </div>
      </div>`).join('');
    return `<div class="home-skel">
      <div class="home-skel-header"></div>
      <div class="home-skel-stats"></div>
      <div class="home-skel-grid">${cards}</div>
    </div>`;
  }

  function renderError(msg) {
    return `<div class="home-error">
      <i class="fa-solid fa-circle-exclamation"></i>
      <h2>加载失败</h2>
      <p>${esc(msg)}</p>
      <button onclick="location.reload()"><i class="fa-solid fa-rotate"></i> 重试</button>
    </div>`;
  }

  // ====================== 注入 <head> 样式 ======================
  function injectHead(data) {
    const head = data.head;
    const styles = `<style>${head.cssVars}${head.customCardCss ? head.customCardCss : ''}</style>`;
    const existing = document.getElementById('home-runtime-style');
    if (existing) existing.remove();
    const styleEl = document.createElement('div');
    styleEl.id = 'home-runtime-style';
    styleEl.innerHTML = styles + (head.hideAdminCss || '');
    document.head.appendChild(styleEl);

    // 字体 + 预连接
    const links = [head.preconnectFonts, head.preconnectIcon, head.preloadWallpaper, head.fontLinks, head.customFontLink]
      .filter(Boolean).join('');
    if (links) {
      const wrap = document.createElement('div');
      wrap.id = 'home-runtime-links';
      wrap.innerHTML = links;
      document.head.appendChild(wrap);
    }
  }

  // ====================== SEO meta 更新 ======================
  function updateSeoMeta(data) {
    if (data.siteName) {
      document.title = `${data.siteName} - 网址导航`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', data.siteDescription || '');
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${data.siteName} - 网址导航`);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', data.siteDescription || '');
      document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', data.siteName);
      document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', `${data.siteName} - 网址导航`);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', data.siteDescription || '');
    }
  }

  // ====================== 设置 admin meta ======================
  function setAdminMeta(data) {
    let authMeta = document.querySelector('meta[name="admin-authenticated"]');
    if (!authMeta) {
      authMeta = document.createElement('meta');
      authMeta.name = 'admin-authenticated';
      document.head.appendChild(authMeta);
    }
    authMeta.content = data.isAuthenticated ? 'true' : 'false';
    if (data.isAuthenticated && data.csrf) {
      let csrfMeta = document.querySelector('meta[name="csrf-token"]');
      if (!csrfMeta) {
        csrfMeta = document.createElement('meta');
        csrfMeta.name = 'csrf-token';
        document.head.appendChild(csrfMeta);
      }
      csrfMeta.content = data.csrf;
    }
  }

  // ====================== 计算派生 layout 数据 ======================
  function computeDerived(data) {
    const S = data.settings;
    const catPos = normalizeCategoryPosition(S.home_category_position, S.layout_menu_layout);
    const catFlow = S.home_category_flow === 'multi_line' ? 'multi_line' : 'single_line';
    data.layout._categoryPosition = catPos;
    data.layout._categoryFlow = catFlow;
    data.layout._sidebarClass = catPos === 'left' ? '' : 'min-[550px]:hidden';
    data.layout._mainClass = catPos === 'left' ? 'lg:ml-64' : '';
    data.layout._sidebarToggleClass = catPos === 'left' ? '' : '!hidden';
    data.layout._mobileToggleVisibilityClass = catPos === 'left' ? 'lg:hidden' : 'min-[550px]:hidden';

    // Grid class
    const getMobileGrid = (cols) => cols === '1' ? 'grid-cols-1' : (cols === '3' ? 'grid-cols-3' : 'grid-cols-2');
    const getDesktopGrid = (cols) => {
      if (cols === '5') return 'md:grid-cols-3 lg:grid-cols-5';
      if (cols === '6') return 'md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6';
      if (cols === '7') return 'md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7';
      return 'md:grid-cols-3 lg:grid-cols-4';
    };
    const getCardStyleGrid = (style, prefix) => {
      if (style === 'style3') return `${prefix}-card-style3`;
      return style === 'style2' ? `${prefix}-card-style2` : `${prefix}-card-style1`;
    };
    const mobileCls = `${getCardStyleGrid(S.mobile_layout_card_style, 'mobile')}`;
    const desktopCls = `${getCardStyleGrid(S.layout_card_style, 'desktop')}`;
    data.layout._gridClass = `grid ${getMobileGrid(S.mobile_layout_grid_cols)} ${getDesktopGrid(S.layout_grid_cols)} ${mobileCls} ${desktopCls} gap-3 sm:gap-6 justify-items-center`;

    return data;
  }

  // ====================== 主渲染流程 ======================
  async function render() {
    const app = document.getElementById(APP_ROOT_ID);
    if (!app) {
      console.warn('[home-render] #app root not found');
      return;
    }

    // 1. 立即显示骨架屏
    app.innerHTML = renderSkeleton();
    document.body.classList.add('home-loading');

    // 2. 拉取数据（带 catalog 参数透传）
    const url = new URL(window.location.href);
    const catalogParam = url.searchParams.get('catalog') || '';
    const apiUrl = API_PATH + (catalogParam ? `?catalog=${encodeURIComponent(catalogParam)}` : '');

    let data;
    try {
      const res = await fetch(apiUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error('[home-render] fetch failed:', err);
      app.innerHTML = renderError(err.message || '网络错误');
      document.body.classList.remove('home-loading');
      document.body.classList.add('home-error-state');
      return;
    }

    // 3. 计算派生数据
    data = computeDerived(data);

    // 4. 注入 <head> 样式
    injectHead(data);

    // 5. 更新 SEO meta
    updateSeoMeta(data);

    // 6. 渲染 DOM
    const isHorizontal = data.layout._categoryPosition !== 'left';
    const showLeftTop = !isHorizontal;
    const showSidebarToggle = isHorizontal;

    app.innerHTML = [
      renderBackground(data),
      renderLeftTopAction(showLeftTop),
      renderRightTopActions(!data.settings.home_hide_admin),
      renderMobileOverlay(),
      renderSidebarToggle(showSidebarToggle),
      renderSidebar(data),
      `<main class="main-content ${data.layout._mainClass} min-h-screen transition-all duration-300">
        ${renderHeader(data)}
        ${renderStats(data)}
        ${renderSitesSection(data)}
      </main>`,
      renderFooter(data),
      renderFloatingButtons(data),
    ].join('');

    // 7. 设置 window 全局（兼容老 JS）
    window.IORI_SITES = data.sites;
    window.IORI_CARD_CONFIG = data.cardState.config;
    window.IORI_CARD_CONFIGS = data.cardState.configs;
    window.IORI_LAYOUT_CONFIG = data.layout;

    // 8. admin meta
    setAdminMeta(data);

    // 9. 标记就绪
    document.body.classList.remove('home-loading');
    document.body.classList.add('home-ready');

    // 10. 派发事件，让 home-ui.js 等旧 JS 重新初始化
    document.dispatchEvent(new CustomEvent('home-rendered', { detail: data }));
  }

  // ====================== 启动 ======================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  // 暴露 API（用于热重载 / 调试）
  window.HomeRender = { render, computeDerived };
})();