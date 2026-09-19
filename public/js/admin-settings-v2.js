/* =========================================================================
 * admin-settings-v2.js
 * 重构后的设置面板增强逻辑（渐进增强，不破坏原功能）
 * - 风格预设：一键应用 5 套预设
 * - 设置搜索：实时过滤设置项
 * - 折叠分组：details/summary 行为增强 + 状态记忆
 * ========================================================================= */

(function () {
  'use strict';

  if (window.AdminSettingsV2) return; // 单例
  const ns = (window.AdminSettingsV2 = {});

  // ============================================================
  // 1) 风格预设：一键应用
  // ============================================================

  /**
   * 每个预设是一组 setting → value 的覆盖。
   * 命名空间使用 currentSettings（同 AdminSettings.currentSettings）。
   */
  const PRESETS = {
    default: {
      label: '默认',
      icon: '🎯',
      desc: '清爽简洁的默认外观',
      settings: {
        // 首页
        home_hide_stats: false,
        home_hide_hitokoto: false,
        home_hide_admin: false,
        home_search_engine_enabled: false,
        home_category_position: 'below_search',
        home_category_flow: 'single_line',
        // 卡片
        layout_grid_cols: '4',
        layout_card_style: 'style1',
        layout_card_animation: 'radial',
        layout_card_border_radius: '12',
        layout_hide_category: false,
        layout_hide_desc: false,
        layout_hide_links: false,
        layout_enable_frosted_glass: false,
        layout_frosted_glass_intensity: '15',
        // 移动
        mobile_layout_grid_cols: '3',
        mobile_layout_card_style: 'style2',
        mobile_layout_hide_category: false,
        mobile_layout_hide_desc: true,
        mobile_layout_hide_links: true,
        // 壁纸
        layout_enable_bg_blur: false,
        layout_bg_blur_intensity: '0',
      },
    },

    minimal: {
      label: '简约',
      icon: '✨',
      desc: '去除一切装饰，纯净链接列表',
      settings: {
        home_hide_stats: true,
        home_hide_hitokoto: true,
        home_hide_admin: true,
        home_search_engine_enabled: true,
        home_category_position: 'top',
        home_category_flow: 'multi_line',
        layout_grid_cols: '6',
        layout_card_style: 'style3',
        layout_card_animation: 'fadeIn',
        layout_card_border_radius: '4',
        layout_hide_category: true,
        layout_hide_desc: true,
        layout_hide_links: true,
        layout_enable_frosted_glass: false,
        layout_hide_title: false,
        layout_hide_subtitle: false,
        mobile_layout_grid_cols: '2',
        mobile_layout_card_style: 'style3',
        mobile_layout_hide_category: true,
        mobile_layout_hide_desc: true,
        mobile_layout_hide_links: true,
        layout_enable_bg_blur: true,
        layout_bg_blur_intensity: '20',
      },
    },

    magazine: {
      label: '杂志',
      icon: '📰',
      desc: '显眼的标题、长描述、居中卡片',
      settings: {
        home_hide_stats: false,
        home_hide_hitokoto: false,
        home_hide_admin: false,
        home_search_engine_enabled: false,
        home_category_position: 'below_search',
        home_category_flow: 'single_line',
        layout_grid_cols: '5',
        layout_card_style: 'style2',
        layout_card_animation: 'convergeIn',
        layout_card_border_radius: '16',
        layout_hide_category: false,
        layout_hide_desc: false,
        layout_hide_links: false,
        layout_enable_frosted_glass: false,
        mobile_layout_grid_cols: '2',
        mobile_layout_card_style: 'style2',
        mobile_layout_hide_category: false,
        mobile_layout_hide_desc: false,
        mobile_layout_hide_links: true,
        layout_enable_bg_blur: false,
      },
    },

    compact: {
      label: '紧凑',
      icon: '▦',
      desc: '更多列、更小卡片，信息密度高',
      settings: {
        home_hide_stats: true,
        home_hide_hitokoto: true,
        home_hide_admin: true,
        home_search_engine_enabled: false,
        home_category_position: 'above_search',
        home_category_flow: 'single_line',
        layout_grid_cols: '7',
        layout_card_style: 'style3',
        layout_card_animation: 'slideUp',
        layout_card_border_radius: '8',
        layout_hide_category: true,
        layout_hide_desc: true,
        layout_hide_links: true,
        layout_enable_frosted_glass: false,
        mobile_layout_grid_cols: '3',
        mobile_layout_card_style: 'style3',
        mobile_layout_hide_category: true,
        mobile_layout_hide_desc: true,
        mobile_layout_hide_links: true,
        layout_enable_bg_blur: false,
      },
    },

    glass: {
      label: '玻璃',
      icon: '💎',
      desc: 'iOS 风格毛玻璃，景深效果好',
      settings: {
        home_hide_stats: false,
        home_hide_hitokoto: true,
        home_hide_admin: false,
        home_search_engine_enabled: true,
        home_category_position: 'below_search',
        home_category_flow: 'single_line',
        layout_grid_cols: '4',
        layout_card_style: 'style1',
        layout_card_animation: 'flipIn',
        layout_card_border_radius: '20',
        layout_hide_category: false,
        layout_hide_desc: false,
        layout_hide_links: true,
        layout_enable_frosted_glass: true,
        layout_frosted_glass_intensity: '25',
        mobile_layout_grid_cols: '2',
        mobile_layout_card_style: 'style1',
        mobile_layout_hide_category: false,
        mobile_layout_hide_desc: true,
        mobile_layout_hide_links: true,
        mobile_layout_enable_frosted_glass: true,
        mobile_layout_frosted_glass_intensity: '25',
        layout_enable_bg_blur: true,
        layout_bg_blur_intensity: '15',
      },
    },
  };

  function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;

    const root = ns.getSettingsRoot();
    if (!root) return;
    const settings = root.currentSettings;

    Object.assign(settings, preset.settings);

    // 同步到 UI
    if (typeof root.updateUIFromSettings === 'function') {
      root.updateUIFromSettings();
    }

    // 触发预览刷新
    if (window.AdminSettings?.preview?.scheduleFullPreviewRender) {
      window.AdminSettings.preview.scheduleFullPreviewRender();
    }

    // 高亮当前预设按钮
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });

    // 提示
    if (typeof window.showMessage === 'function') {
      window.showMessage(`已应用「${preset.label}」风格，请点击「保存设置」持久化`, 'info');
    }
  }

  function initPresets(container) {
    if (!container) return;
    container.innerHTML = '';
    Object.entries(PRESETS).forEach(([key, preset]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.dataset.preset = key;
      btn.title = preset.desc;
      btn.innerHTML = `<span class="preset-icon">${preset.icon}</span><span>${preset.label}</span>`;
      btn.addEventListener('click', () => applyPreset(key));
      container.appendChild(btn);
    });
  }

  // ============================================================
  // 2) 设置搜索：实时过滤
  // ============================================================

  /** 给所有设置项打上可搜索关键词 */
  const SEARCHABLE_LABELS = {
    // 首页 - 站点信息
    homeSiteName: '站点名称 网站标题 title',
    homeSiteDescription: '站点描述 网站副标题 description subtitle',
    homeFooterText: '页脚 footer 底部 版权 copyright',
    // 首页 - 导航
    homeDefaultCategory: '默认分类 首页默认 default category',
    homeRememberLastCategorySwitch: '记住分类 remember last category',
    searchEngineSwitch: '搜索 google baidu github 站外搜索 search engine',
    hideAdminSwitch: '隐藏 管理 后台 图标 hide admin',
    // 首页 - 分类位置 (radio)
    categoryPosition: '分类位置 category position 搜索框上下 左侧 顶部',
    categoryFlow: '分类排列 单行 多行 单行换行 flow',
    // 首页 - 排版
    hideTitleSwitch: '隐藏 标题 hide title 站点名称',
    homeTitleFont: '标题字体 字体 font',
    homeTitleSize: '标题大小 字号 size 像素 px',
    homeTitleColor: '标题颜色 颜色 color',
    hideSubtitleSwitch: '隐藏 副标题 描述 hide subtitle',
    homeSubtitleFont: '副标题字体 描述字体 font',
    homeSubtitleSize: '副标题大小 字号 size 描述大小',
    homeSubtitleColor: '副标题颜色 描述颜色 color',
    hideStatsSwitch: '隐藏 统计 卡片统计 数量 hide stats',
    homeStatsFont: '统计字体 font',
    homeStatsSize: '统计大小 size',
    homeStatsColor: '统计颜色 color',
    hideHitokotoSwitch: '隐藏 一言 hitokoto 一句话',
    homeHitokotoFont: '一言字体 font',
    homeHitokotoSize: '一言大小 size',
    homeHitokotoColor: '一言颜色 color',
    // 卡片 - 桌面
    gridCols: '桌面 布局 列数 grid columns 桌面布局',
    cardAnimationSelect: '动画 animation 切换效果 过渡',
    cardRadius: '圆角 radius 卡片圆角 桌面',
    btnStyle1: '卡片风格 style 风格一 风格 桌面',
    btnStyle2: '卡片风格 style 风格二 风格 桌面',
    btnStyle3: '卡片风格 style 风格三 风格 桌面 紧凑',
    hideCategorySwitch: '隐藏分类 hide category 桌面',
    hideDescSwitch: '隐藏描述 hide description 桌面',
    hideLinksSwitch: '隐藏链接 hide links 桌面',
    frostedGlassSwitch: '毛玻璃 frosted glass blur 桌面',
    frostedGlassIntensity: '毛玻璃程度 模糊度 桌面',
    cardTitleFont: '卡片标题字体 font 桌面',
    cardTitleSize: '卡片标题大小 size 桌面',
    cardTitleColor: '卡片标题颜色 color 桌面',
    cardDescFont: '卡片描述字体 font 桌面',
    cardDescSize: '卡片描述大小 size 桌面',
    cardDescColor: '卡片描述颜色 color 桌面',
    // 卡片 - 移动
    mobileGridCols: '手机 移动 布局 列数 mobile columns',
    mobileBtnStyle1: '手机 卡片风格 style 风格一',
    mobileBtnStyle2: '手机 卡片风格 style 风格二',
    mobileBtnStyle3: '手机 卡片风格 style 风格三',
    mobileCardAnimationSelect: '手机 切换动画 移动',
    mobileCardRadius: '手机 卡片圆角 移动',
    mobileHideCategorySwitch: '手机 隐藏分类 移动',
    mobileHideDescSwitch: '手机 隐藏描述 移动',
    mobileHideLinksSwitch: '手机 隐藏链接 移动',
    mobileFrostedGlassSwitch: '手机 毛玻璃 移动',
    mobileFrostedGlassIntensity: '手机 毛玻璃程度 移动',
    mobileCardTitleFont: '手机 卡片标题字体 移动',
    mobileCardTitleSize: '手机 卡片标题大小 移动',
    mobileCardTitleColor: '手机 卡片标题颜色 移动',
    mobileCardDescFont: '手机 卡片描述字体 移动',
    mobileCardDescSize: '手机 卡片描述大小 移动',
    mobileCardDescColor: '手机 卡片描述颜色 移动',
    // 壁纸
    customWallpaperInput: '壁纸 wallpaper 自定义背景 自定义壁纸 图片链接',
    bgBlurSwitch: '背景虚化 bg blur 虚化背景',
    bgBlurIntensity: '背景虚化程度 模糊度',
    bingCountry: '壁纸 来源 bing 360 国家地区',
    onlineWallpapers: '壁纸库 在线 wallpaper gallery',
    // AI
    providerSelector: 'AI 模型 provider 服务商 workers-ai gemini openai',
    apiKey: 'AI 密钥 api key token',
    baseUrl: 'AI 地址 base url api 接入点',
    modelName: 'AI 模型名称 model',
    batchCompleteDescBtn: 'AI 批量补全 描述 一键生成',
  };

  /**
   * 在每个 <details class="settings-section"> 下，给每个设置项（input/select/button）打上 data-search-key。
   * 设置项容器的祖先 .settings-row 也带上 data-search-key。
   */
  function indexSearchableItems() {
    // 遍历所有 settings tab content（不论是否被 details 包裹）
    document.querySelectorAll('.settings-tab-content').forEach((tabContent) => {
      // 遍历 tab content 下的每个 "section"（可能是 details.settings-section 或者直接子级分组）
      const sections = tabContent.querySelectorAll(':scope > div, details.settings-section');
      sections.forEach((section) => {
        const sectionKeywords = (section.dataset.searchKeywords || section.querySelector?.('summary')?.textContent || '').trim();
        if (!sectionKeywords) {
          // 用 tab 名作为 section 关键词
          const tabId = tabContent.id || '';
          sectionKeywords = tabId;
        }

        section.querySelectorAll('input, select, textarea, button[data-style], button[data-animation]').forEach((el) => {
          const id = el.id || el.name || '';
          const keywords = SEARCHABLE_LABELS[id] || '';
          const row = el.closest('.settings-row')
            || el.closest('.form-group[data-search-row="1"]')
            || el.closest('.form-group')

          if (row && row !== section && row !== tabContent) {
            const current = row.dataset.searchKey || '';
            row.dataset.searchKey = (sectionKeywords + ' ' + keywords + ' ' + getElementText(el) + ' ' + getElementText(row) + ' ' + current).trim();
          }

          el.dataset.searchKey = keywords;
        });
      });
    });
  }

  function getElementText(el) {
    if (!el) return '';
    // 优先从 label 取
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent.trim();
    }
    // 同一 form-group 下的 label
    const parent = el.closest('.settings-row, .form-group, .card-option-row');
    if (parent) {
      const labelEl = parent.querySelector('label, .settings-row-label-text, .card-option-label');
      if (labelEl) return labelEl.textContent.trim();
    }
    // segment 控件
    const segLabel = el.closest('label');
    if (segLabel) return segLabel.textContent.trim();
    return el.textContent?.trim() || el.placeholder || '';
  }

  function performSearch(query) {
    const root = ns.getSettingsRoot();
    if (!root) return;
    const q = (query || '').trim().toLowerCase();
    const wrap = document.querySelector('.settings-search-wrap');
    const resultSpan = document.querySelector('.settings-search-result');

    wrap?.classList.toggle('has-value', !!q);

    if (!q) {
      // 清空搜索：显示全部
      document.body.classList.remove('settings-searching');
      document.querySelectorAll('[data-search-match]').forEach((el) => {
        delete el.dataset.searchMatch;
      });
      document.querySelectorAll('[data-section-match]').forEach((el) => {
        delete el.dataset.sectionMatch;
      });
      document.querySelectorAll('mark.search-hl').forEach((m) => {
        const text = m.textContent;
        m.replaceWith(document.createTextNode(text));
      });
      if (resultSpan) resultSpan.textContent = '';
      return;
    }

    document.body.classList.add('settings-searching');
    let matchCount = 0;

    // 遍历每个设置项
    document.querySelectorAll('.settings-section, .settings-tab-content').forEach((section) => {
      let sectionMatches = 0;

      const itemSelector = '.settings-row, .form-group[data-search-row="1"], .form-group[class*="flex items-center justify-between"]';
      section.querySelectorAll(itemSelector).forEach((row) => {
        const keys = (row.dataset.searchKey || '').toLowerCase();
        const isMatch = keys.includes(q);
        row.dataset.searchMatch = isMatch ? '1' : '0';
        if (isMatch) {
          sectionMatches++;
          matchCount++;
          highlightInElement(row, q);
        } else {
          removeHighlight(row);
        }
      });

      section.dataset.sectionMatch = sectionMatches > 0 ? '1' : '0';
      if (sectionMatches > 0 && !section.open) {
        section.open = true;
      }
    });

    if (resultSpan) {
      if (matchCount === 0) {
        resultSpan.textContent = `没有匹配项`;
        resultSpan.classList.add('no-match');
      } else {
        resultSpan.textContent = `找到 ${matchCount} 项`;
        resultSpan.classList.remove('no-match');
      }
    }
  }

  function highlightInElement(row, query) {
    // 简单高亮文字标签
    row.querySelectorAll('label, .settings-row-label-text').forEach((el) => {
      if (el.querySelector('input, select')) return;
      const text = el.textContent;
      if (text.toLowerCase().includes(query)) {
        const re = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        el.innerHTML = text.replace(re, '<mark class="search-hl">$1</mark>');
      }
    });
  }

  function removeHighlight(row) {
    row.querySelectorAll('mark.search-hl').forEach((m) => {
      m.replaceWith(document.createTextNode(m.textContent));
    });
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function initSearch(input) {
    if (!input) return;
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => performSearch(input.value), 120);
    });
    // 快捷键 Ctrl/Cmd + K 聚焦搜索
    document.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const modal = document.getElementById('settingsModal');
        if (modal && modal.style.display !== 'none') {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
      if (e.key === 'Escape' && document.activeElement === input) {
        input.value = '';
        performSearch('');
      }
    });
  }

  // ============================================================
  // 2.5) 自动将高级排版块收纳为 <details>（运行时增强）
  // ============================================================

  /**
   * 识别"高级排版"块（包含 font/size/color 三件套的灰色分组），自动收纳。
   */
  function autoWrapAdvancedSections() {
    const candidates = document.querySelectorAll('.settings-tab-content .p-3.bg-gray-50.rounded');

    candidates.forEach((block) => {
      // 跳过已被包裹的
      if (block.closest('details.settings-section')) return;

      // 识别条件：包含至少 2 个 typography 控件
      const hasFontSelect = block.querySelector('select[id*="Font"]');
      const hasSizeInput = block.querySelector('input[type="number"][id*="Size"]');
      const hasColorInput = block.querySelector('input[type="color"]') || block.querySelector('input[id*="Color"]:not([type="checkbox"])');
      const typographyScore = (hasFontSelect ? 1 : 0) + (hasSizeInput ? 1 : 0) + (hasColorInput ? 1 : 0);

      if (typographyScore < 2) return; // 不是排版块，跳过

      const heading = block.querySelector('h4');
      if (!heading) return;
      const headingText = heading.textContent.trim();

      // 跳过基础信息类（站点信息）
      if (headingText.includes('站点信息')) return;

      // 创建一个 details 包裹
      const details = document.createElement('details');
      details.className = 'settings-section';
      details.dataset.advanced = 'true';

      const summary = document.createElement('summary');
      const titleSpan = document.createElement('span');
      titleSpan.className = 'settings-section-summary-icon';
      titleSpan.textContent = '🎨';
      const titleText = document.createElement('span');
      titleText.className = 'settings-section-summary-title';
      titleText.textContent = headingText.replace(/\s*\(Style\)\s*/g, '').trim();
      const tag = document.createElement('span');
      tag.className = 'settings-section-summary-tag advanced';
      tag.textContent = '高级';

      summary.appendChild(titleSpan);
      summary.appendChild(titleText);
      summary.appendChild(tag);

      const body = document.createElement('div');
      body.className = 'settings-section-body';

      details.appendChild(summary);
      details.appendChild(body);

      // 把 block 的所有子节点（除了 h4）移到 body
      Array.from(block.children).forEach((child) => {
        if (child !== heading) {
          body.appendChild(child);
        }
      });

      // 替换原 block 为 details
      block.parentNode.insertBefore(details, block);
      block.parentNode.removeChild(block);

      // 给 details 一个稳定的 id
      const stableId = 'adv-' + headingText.replace(/[^\w\u4e00-\u9fa5]/g, '-').toLowerCase().slice(0, 40);
      details.id = stableId;
    });
  }

  /**
   * 把每个设置项容器（form-group、settings-row、card-option-row）打上统一的标记，
   * 方便搜索过滤时定位
   */
  function normalizeItemContainers() {
    document.querySelectorAll('.settings-tab-content').forEach((tab) => {
      // 标记所有 form-group 为可搜索行
      tab.querySelectorAll('.form-group').forEach((group) => {
        if (!group.classList.contains('settings-row') && !group.closest('.settings-row')) {
          group.dataset.searchRow = '1';
        }
      });

      // 标记所有 card-option-row 为可搜索行（radio 组、segment 组）
      tab.querySelectorAll('.card-option-row').forEach((row) => {
        if (!row.dataset.searchRow) {
          row.dataset.searchRow = '1';
          row.classList.add('settings-row');
        }
      });
    });
  }

  // ============================================================
  // 3) 折叠状态记忆
  // ============================================================
  const STORAGE_KEY = 'h-panel:settings-collapse-state';

  function loadCollapseState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveCollapseState() {
    const state = {};
    document.querySelectorAll('details.settings-section').forEach((s, idx) => {
      state[s.id || `section-${idx}`] = s.open;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function applyCollapseState() {
    const state = loadCollapseState();
    document.querySelectorAll('details.settings-section').forEach((s, idx) => {
      const key = s.id || `section-${idx}`;
      if (key in state) {
        s.open = !!state[key];
      }
    });
  }

  function initCollapseMemory() {
    document.addEventListener('toggle', (e) => {
      if (e.target.matches('details.settings-section')) {
        saveCollapseState();
      }
    }, true);
  }

  // ============================================================
  // 4) 初始化
  // ============================================================

  function getSettingsRoot() {
    return window.AdminSettings?.core || window.AdminSettings;
  }

  function init() {
    const presetContainer = document.getElementById('settingsPresets');
    const searchInput = document.getElementById('settingsSearchInput');
    const clearBtn = document.getElementById('settingsSearchClear');

    if (!presetContainer && !searchInput) {
      console.info('[AdminSettingsV2] 未找到增强 UI，跳过初始化');
      return false;
    }

    initPresets(presetContainer);
    initSearch(searchInput);
    clearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        performSearch('');
        searchInput.focus();
      }
    });

    // 等 DOM 完全渲染后再索引（settings 模态框可能延迟打开）
    const setup = () => {
      autoWrapAdvancedSections(); // 把高级排版块收纳
      normalizeItemContainers();  // 规范化容器
      indexSearchableItems();
      applyCollapseState();
    };

    // 模态框每次打开都重新索引（因为可能动态切换标签页）
    const observer = new MutationObserver(() => {
      const modal = document.getElementById('settingsModal');
      if (modal && modal.style.display !== 'none') {
        setup();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

    initCollapseMemory();
    setup();

    console.info('[AdminSettingsV2] 已初始化：预设 / 搜索 / 折叠');
    return true;
  }

  // 自动初始化（如果 DOM 已就绪）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露 API
  ns.applyPreset = applyPreset;
  ns.performSearch = performSearch;
  ns.PRESETS = PRESETS;
})();
