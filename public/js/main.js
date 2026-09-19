// public/js/main.js
// 启动入口：等待 home-render.js 完成渲染，再初始化所有 home-*.js 模块
// 保留 IoriHome 命名空间以兼容 home-ui.js / home-cards.js / home-search.js 等

(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  // 公共 UI 初始化（侧栏、主题切换等）— 只需执行一次
  let commonUiInitialized = false;
  function initCommonUiOnce() {
    if (commonUiInitialized) return;
    Home.initCommonUi?.();
    commonUiInitialized = true;
  }

  // 主初始化流程：DOM 渲染完成后跑
  function initHomeModules() {
    initCommonUiOnce();

    if (typeof Home.createCardController === 'function') {
      Home.cardController = Home.createCardController();
      Home.cardController.init();
    }

    Home.initSubmission?.();
    Home.initSearch?.();
    Home.initCategoryNavigation?.();
    Home.initEditMode?.();

    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // 第一次：home-render.js 可能还没完成（fetch 是 async）
      // 如果 #app 已经有站点卡片（cached or 极快完成），立即初始化
      if (document.querySelector('.site-card')) {
        initHomeModules();
      }
      // 否则等 home-rendered 事件
      document.addEventListener('home-rendered', initHomeModules, { once: true });
    });
  } else {
    if (document.querySelector('.site-card')) {
      initHomeModules();
    } else {
      document.addEventListener('home-rendered', initHomeModules, { once: true });
    }
  }

  // 暴露：供调试 / 强制重渲染
  Home.boot = initHomeModules;
})();