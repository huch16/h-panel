// 首页可视化编辑模式（仅管理员）：右键编辑/删除书签与分类、卡片拖拽排序、分类排序
(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initEditMode = function () {
    const adminMeta = document.querySelector('meta[name="admin-authenticated"]');
    if (!adminMeta || adminMeta.getAttribute('content') !== 'true') return;

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

    const editModeBtn = document.getElementById('homeEditModeBtn');
    const editToolbar = document.getElementById('homeEditToolbar');
    const sortCategoryBtn = document.getElementById('homeSortCategoryBtn');
    const exitBtn = document.getElementById('homeEditExitBtn');
    const contextMenu = document.getElementById('homeContextMenu');
    const sitesGrid = document.getElementById('sitesGrid');

    const editSiteModal = document.getElementById('homeEditSiteModal');
    const editSiteForm = document.getElementById('homeEditSiteForm');
    const editSiteMessage = document.getElementById('homeEditMessage');

    const deleteSiteModal = document.getElementById('homeDeleteSiteModal');
    const deleteSiteName = document.getElementById('homeDeleteSiteName');

    const categoryModal = document.getElementById('homeCategoryModal');
    const categoryForm = document.getElementById('homeCategoryForm');
    const categoryMessage = document.getElementById('homeCategoryMessage');

    const categorySortModal = document.getElementById('homeCategorySortModal');
    const categorySortList = document.getElementById('homeCategorySortList');
    const categorySortMessage = document.getElementById('homeCategorySortMessage');

    let editModeActive = false;
    let ctxTargetType = null;
    let ctxTargetId = null;
    let categoriesCache = null;
    let dragSource = null;
    let categorySortDragSource = null;
    let mutationObserver = null;

    if (csrfToken) {
      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        init = init || {};
        const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          if (init.headers instanceof Headers) {
            if (!init.headers.has('X-CSRF-Token')) init.headers.set('X-CSRF-Token', csrfToken);
          } else {
            init.headers = init.headers || {};
            if (!init.headers['X-CSRF-Token']) init.headers['X-CSRF-Token'] = csrfToken;
          }
        }
        return originalFetch.call(this, input, init);
      };
    }

    // ---------- 通用弹窗 ----------
    function openModal(modal) {
      if (!modal) return;
      modal.classList.remove('opacity-0', 'invisible');
      modal.querySelector('.max-w-md, .max-w-sm')?.classList.remove('translate-y-8');
      document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
      if (!modal) return;
      modal.classList.add('opacity-0', 'invisible');
      modal.querySelector('.max-w-md, .max-w-sm')?.classList.add('translate-y-8');
      document.body.style.overflow = '';
    }

    function showMessage(el, message, type = 'error') {
      if (!el) return;
      const styleMap = {
        error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
        warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
        info: 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-200',
        success: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200',
      };
      el.className = `rounded-lg border px-3 py-2 text-sm leading-relaxed ${styleMap[type] || styleMap.error}`;
      el.textContent = message;
    }

    function hideMessage(el) {
      if (!el) return;
      el.className = 'hidden rounded-lg border px-3 py-2 text-sm leading-relaxed';
      el.textContent = '';
    }

    // ---------- 分类数据 ----------
    function buildCategoryTree(categories) {
      const map = new Map();
      const roots = [];
      categories.forEach(category => {
        map.set(category.id, { ...category, children: [] });
      });
      categories.forEach(category => {
        const node = map.get(category.id);
        if (category.parent_id && map.has(category.parent_id)) {
          map.get(category.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });
      const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
          const orderA = Number(a.sort_order);
          const orderB = Number(b.sort_order);
          const safeOrderA = Number.isFinite(orderA) ? orderA : 9999;
          const safeOrderB = Number.isFinite(orderB) ? orderB : 9999;
          return safeOrderA - safeOrderB || a.id - b.id;
        });
        nodes.forEach(node => sortNodes(node.children));
      };
      sortNodes(roots);
      return roots;
    }

    function flattenCategoryOptions(nodes, depth = 0, options = []) {
      nodes.forEach(node => {
        const prefix = depth > 0 ? `${'　'.repeat(depth)}└─ ` : '';
        options.push({ id: node.id, label: `${prefix}${node.catelog}` });
        if (node.children?.length) flattenCategoryOptions(node.children, depth + 1, options);
      });
      return options;
    }

    function findCategoryById(nodes, id) {
      for (const node of nodes) {
        if (String(node.id) === String(id)) return node;
        const found = findCategoryById(node.children || [], id);
        if (found) return found;
      }
      return null;
    }

    async function fetchCategories() {
      if (categoriesCache) return categoriesCache;
      const res = await fetch('/api/categories?pageSize=10000');
      const data = await res.json();
      if (data.code === 200 && Array.isArray(data.data)) {
        categoriesCache = buildCategoryTree(data.data);
      } else {
        categoriesCache = [];
      }
      return categoriesCache;
    }

    // ---------- 编辑模式开关 ----------
    function enterEditMode() {
      editModeActive = true;
      document.body.classList.add('home-edit-mode');
      editModeBtn.classList.add('hidden');
      editModeBtn.classList.remove('flex');
      editToolbar.classList.remove('hidden');
      editToolbar.classList.add('flex');
      enableCardDrag();
      observeGrid();
    }

    function exitEditMode() {
      editModeActive = false;
      document.body.classList.remove('home-edit-mode');
      editToolbar.classList.add('hidden');
      editToolbar.classList.remove('flex');
      editModeBtn.classList.remove('hidden');
      editModeBtn.classList.add('flex');
      disableCardDrag();
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      hideContextMenu();
    }

    editModeBtn?.addEventListener('click', enterEditMode);
    exitBtn?.addEventListener('click', exitEditMode);

    // ---------- 卡片拖拽排序 ----------
    function enableCardDrag() {
      sitesGrid?.querySelectorAll('.site-card').forEach(card => card.setAttribute('draggable', 'true'));
    }

    function disableCardDrag() {
      sitesGrid?.querySelectorAll('.site-card').forEach(card => card.removeAttribute('draggable'));
    }

    function observeGrid() {
      if (!sitesGrid || mutationObserver) return;
      mutationObserver = new MutationObserver(() => {
        if (editModeActive) enableCardDrag();
      });
      mutationObserver.observe(sitesGrid, { childList: true });
    }

    if (sitesGrid) {
      sitesGrid.addEventListener('dragstart', (e) => {
        if (!editModeActive) return;
        const card = e.target.closest('.site-card');
        if (!card) return;
        dragSource = card;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-id') || '');
        requestAnimationFrame(() => card.classList.add('home-dragging'));
      });

      sitesGrid.addEventListener('dragover', (e) => {
        if (!editModeActive || !dragSource) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.site-card');
        if (!target || target === dragSource) return;
        const rect = target.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2 || e.clientX > rect.left + rect.width / 2;
        if (isAfter) {
          if (target.nextElementSibling !== dragSource) target.after(dragSource);
        } else {
          if (target.previousElementSibling !== dragSource) target.before(dragSource);
        }
      });

      sitesGrid.addEventListener('dragend', async () => {
        const card = dragSource;
        dragSource = null;
        card?.classList.remove('home-dragging');
        if (!editModeActive) return;
        await saveCardOrder();
      });

      sitesGrid.addEventListener('drop', (e) => {
        e.preventDefault();
      });
    }

    async function saveCardOrder() {
      const cards = Array.from(sitesGrid.querySelectorAll('.site-card'));
      const items = cards.map((card, index) => ({
        id: Number(card.getAttribute('data-id')),
        sort_order: index + 1,
      }));
      if (items.length === 0) return;

      try {
        const res = await fetch('/api/config/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', payload: { items } }),
        });
        const data = await res.json();
        if (data.code === 200) {
          const orderMap = new Map(items.map(item => [String(item.id), item.sort_order]));
          (window.IORI_SITES || []).forEach(s => {
            if (orderMap.has(String(s.id))) s.sort_order = orderMap.get(String(s.id));
          });
          Home.showToast?.('排序已保存');
        } else {
          Home.showToast?.(data.message || '排序保存失败');
        }
      } catch (err) {
        console.error('保存排序失败:', err);
        Home.showToast?.('网络错误，排序保存失败');
      }
    }

    // ---------- 右键菜单 ----------
    function showContextMenu(x, y) {
      const menuWidth = contextMenu.offsetWidth || 150;
      const menuHeight = contextMenu.offsetHeight || 150;
      contextMenu.style.left = `${Math.min(x, window.innerWidth - menuWidth - 8)}px`;
      contextMenu.style.top = `${Math.min(y, window.innerHeight - menuHeight - 8)}px`;
      contextMenu.classList.remove('hidden');
    }

    function hideContextMenu() {
      contextMenu?.classList.add('hidden');
      ctxTargetType = null;
      ctxTargetId = null;
    }

    document.addEventListener('contextmenu', (e) => {
      if (!editModeActive) return;
      const siteCard = e.target.closest('.site-card');
      const categoryLink = e.target.closest('a[data-id]');

      if (siteCard) {
        e.preventDefault();
        ctxTargetType = 'site';
        ctxTargetId = siteCard.getAttribute('data-id');
        contextMenu.querySelectorAll('.home-ctx-site').forEach(el => el.classList.remove('hidden'));
        contextMenu.querySelectorAll('.home-ctx-category').forEach(el => el.classList.add('hidden'));
        showContextMenu(e.clientX, e.clientY);
        return;
      }

      if (categoryLink) {
        e.preventDefault();
        ctxTargetType = 'category';
        ctxTargetId = categoryLink.getAttribute('data-id');
        contextMenu.querySelectorAll('.home-ctx-category').forEach(el => el.classList.remove('hidden'));
        contextMenu.querySelectorAll('.home-ctx-site').forEach(el => el.classList.add('hidden'));
        showContextMenu(e.clientX, e.clientY);
      }
    });

    document.addEventListener('click', (e) => {
      if (!contextMenu) return;
      if (!contextMenu.contains(e.target)) hideContextMenu();
    });

    document.addEventListener('scroll', hideContextMenu, true);
    window.addEventListener('blur', hideContextMenu);

    contextMenu?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !ctxTargetType) return;
      const action = btn.getAttribute('data-action');
      const id = ctxTargetId;
      hideContextMenu();
      if (action === 'edit' && ctxTargetType === 'site') openEditSite(id);
      else if (action === 'delete' && ctxTargetType === 'site') openDeleteSite(id);
      else if (action === 'edit-category' && ctxTargetType === 'category') openEditCategory(id);
      else if (action === 'delete-category' && ctxTargetType === 'category') deleteCategory(id);
    });

    // ---------- 编辑书签 ----------
    async function openEditSite(id) {
      const siteIdInput = document.getElementById('homeEditSiteId');
      const nameInput = document.getElementById('homeEditName');
      const urlInput = document.getElementById('homeEditUrl');
      const logoInput = document.getElementById('homeEditLogo');
      const descInput = document.getElementById('homeEditDesc');
      const catelogSelect = document.getElementById('homeEditCatelog');
      const sortOrderInput = document.getElementById('homeEditSortOrder');
      const privateCheckbox = document.getElementById('homeEditPrivate');

      hideMessage(editSiteMessage);
      const cats = await fetchCategories();
      catelogSelect.innerHTML = '<option value="" disabled selected>加载分类...</option>';
      flattenCategoryOptions(cats).forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        catelogSelect.appendChild(opt);
      });

      try {
        const res = await fetch(`/api/config/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.code !== 200) {
          showMessage(editSiteMessage, data.message || '获取书签信息失败');
          return;
        }
        const site = data.data;
        siteIdInput.value = site.id;
        nameInput.value = site.name || '';
        urlInput.value = site.url || '';
        logoInput.value = site.logo || '';
        descInput.value = site.desc || '';
        sortOrderInput.value = site.sort_order != null ? site.sort_order : '';
        privateCheckbox.checked = !!site.is_private;
        catelogSelect.value = String(site.catelog_id || '');
        openModal(editSiteModal);
      } catch (err) {
        console.error('获取书签失败:', err);
        showMessage(editSiteMessage, '网络错误，获取书签信息失败');
      }
    }

    editSiteForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(editSiteMessage);
      const id = document.getElementById('homeEditSiteId').value;
      const payload = {
        name: document.getElementById('homeEditName').value,
        url: document.getElementById('homeEditUrl').value,
        logo: document.getElementById('homeEditLogo').value,
        desc: document.getElementById('homeEditDesc').value,
        catelog_id: document.getElementById('homeEditCatelog').value,
        sort_order: Number(document.getElementById('homeEditSortOrder').value) || 0,
        is_private: document.getElementById('homeEditPrivate').checked,
      };

      try {
        const res = await fetch(`/api/config/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.code === 200) {
          Home.showToast?.('书签已更新');
          closeModal(editSiteModal);
          window.location.reload();
        } else {
          showMessage(editSiteMessage, data.message || '保存失败');
        }
      } catch (err) {
        console.error('保存书签失败:', err);
        showMessage(editSiteMessage, '网络错误，保存失败');
      }
    });

    document.getElementById('homeEditCloseBtn')?.addEventListener('click', () => closeModal(editSiteModal));
    document.getElementById('homeEditCancelBtn')?.addEventListener('click', () => closeModal(editSiteModal));
    editSiteModal?.addEventListener('click', (e) => {
      if (e.target === editSiteModal) closeModal(editSiteModal);
    });

    // ---------- 删除书签 ----------
    let pendingDeleteSiteId = null;

    function openDeleteSite(id) {
      pendingDeleteSiteId = id;
      const site = (window.IORI_SITES || []).find(s => String(s.id) === String(id));
      const name = site?.name || site?.nameHtml || '该书签';
      deleteSiteName.textContent = name;
      openModal(deleteSiteModal);
    }

    document.getElementById('homeDeleteCancelBtn')?.addEventListener('click', () => {
      pendingDeleteSiteId = null;
      closeModal(deleteSiteModal);
    });
    deleteSiteModal?.addEventListener('click', (e) => {
      if (e.target === deleteSiteModal) {
        pendingDeleteSiteId = null;
        closeModal(deleteSiteModal);
      }
    });

    document.getElementById('homeDeleteConfirmBtn')?.addEventListener('click', async () => {
      if (!pendingDeleteSiteId) return;
      const id = pendingDeleteSiteId;
      const btn = document.getElementById('homeDeleteConfirmBtn');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/config/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.code === 200) {
          Home.showToast?.('书签已删除');
          closeModal(deleteSiteModal);
          window.location.reload();
        } else {
          Home.showToast?.(data.message || '删除失败');
          btn.disabled = false;
        }
      } catch (err) {
        console.error('删除书签失败:', err);
        Home.showToast?.('网络错误，删除失败');
        btn.disabled = false;
      }
    });

    // ---------- 编辑/删除分类 ----------
    let currentEditCategoryId = null;

    async function openEditCategory(id) {
      currentEditCategoryId = id;
      hideMessage(categoryMessage);
      const cats = await fetchCategories();
      const node = findCategoryById(cats, id);
      document.getElementById('homeCategoryName').value = node?.catelog || '';
      document.getElementById('homeCategoryModalTitle').textContent = '编辑分类';
      document.getElementById('homeCategoryDeleteBtn').classList.remove('hidden');
      openModal(categoryModal);
    }

    categoryForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(categoryMessage);
      if (!currentEditCategoryId) return;
      const catelog = document.getElementById('homeCategoryName').value.trim();
      if (!catelog) {
        showMessage(categoryMessage, '请输入分类名称');
        return;
      }
      try {
        const res = await fetch(`/api/categories/${encodeURIComponent(currentEditCategoryId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catelog }),
        });
        const data = await res.json();
        if (data.code === 200) {
          Home.showToast?.('分类已更新');
          closeModal(categoryModal);
          window.location.reload();
        } else {
          showMessage(categoryMessage, data.message || '保存失败');
        }
      } catch (err) {
        console.error('保存分类失败:', err);
        showMessage(categoryMessage, '网络错误，保存失败');
      }
    });

    async function deleteCategory(id) {
      const cats = await fetchCategories();
      const node = findCategoryById(cats, id);
      const name = node?.catelog || '该分类';
      if (!window.confirm(`确定要删除分类「${name}」吗？`)) return;

      try {
        const res = await fetch(`/api/categories/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true }),
        });
        const data = await res.json();
        if (data.code === 200) {
          Home.showToast?.('分类已删除');
          window.location.reload();
        } else {
          Home.showToast?.(data.message || '删除失败');
        }
      } catch (err) {
        console.error('删除分类失败:', err);
        Home.showToast?.('网络错误，删除失败');
      }
    }

    document.getElementById('homeCategoryCancelBtn')?.addEventListener('click', () => closeModal(categoryModal));
    document.getElementById('homeCategoryDeleteBtn')?.addEventListener('click', async () => {
      if (!currentEditCategoryId) return;
      const id = currentEditCategoryId;
      closeModal(categoryModal);
      await deleteCategory(id);
    });
    categoryModal?.addEventListener('click', (e) => {
      if (e.target === categoryModal) closeModal(categoryModal);
    });

    // ---------- 分类排序 ----------
    let categorySortCache = null;

    sortCategoryBtn?.addEventListener('click', openCategorySortModal);

    document.getElementById('homeCategorySortCloseBtn')?.addEventListener('click', () => closeModal(categorySortModal));
    document.getElementById('homeCategorySortCancelBtn')?.addEventListener('click', () => closeModal(categorySortModal));
    categorySortModal?.addEventListener('click', (e) => {
      if (e.target === categorySortModal) closeModal(categorySortModal);
    });

    async function openCategorySortModal() {
      hideMessage(categorySortMessage);
      const cats = await fetchCategories();
      categorySortCache = cats;
      categorySortList.innerHTML = '';

      if (cats.length === 0) {
        categorySortList.innerHTML = '<li class="text-sm text-gray-500 text-center py-4">暂无可排序的一级分类</li>';
        openModal(categorySortModal);
        return;
      }

      cats.forEach(node => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-2 px-3 py-2 bg-white border border-primary-100 rounded-md shadow-sm cursor-grab select-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100';
        li.setAttribute('draggable', 'true');
        li.dataset.id = node.id;

        const handleSvg = document.createElement('span');
        handleSvg.className = 'text-gray-300 dark:text-gray-500 flex-shrink-0';
        handleSvg.innerHTML = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9h8M8 15h8"/></svg>';
        li.appendChild(handleSvg);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'flex-1 truncate text-sm font-medium';
        nameSpan.textContent = node.catelog;
        li.appendChild(nameSpan);

        if (node.children?.length) {
          const badge = document.createElement('span');
          badge.className = 'text-xs text-gray-400';
          badge.textContent = `${node.children.length} 个子分类`;
          li.appendChild(badge);
        }

        categorySortList.appendChild(li);
      });

      openModal(categorySortModal);
    }

    if (categorySortList) {
      categorySortList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        categorySortDragSource = li;
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => li.classList.add('home-dragging'));
      });

      categorySortList.addEventListener('dragover', (e) => {
        if (!categorySortDragSource) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('li[data-id]');
        if (!target || target === categorySortDragSource) return;
        const rect = target.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        if (isAfter) {
          if (target.nextElementSibling !== categorySortDragSource) target.after(categorySortDragSource);
        } else {
          if (target.previousElementSibling !== categorySortDragSource) target.before(categorySortDragSource);
        }
      });

      categorySortList.addEventListener('drop', (e) => {
        e.preventDefault();
      });

      categorySortList.addEventListener('dragend', (e) => {
        e.target.closest('li[data-id]')?.classList.remove('home-dragging');
        categorySortDragSource = null;
      });
    }

    document.getElementById('homeCategorySortSaveBtn')?.addEventListener('click', async () => {
      hideMessage(categorySortMessage);
      const items = Array.from(categorySortList.querySelectorAll('li[data-id]')).map((li, index) => ({
        id: Number(li.dataset.id),
        sort_order: index + 1,
      }));
      if (items.length === 0) return;

      const btn = document.getElementById('homeCategorySortSaveBtn');
      btn.disabled = true;
      try {
        const res = await fetch('/api/categories/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (data.code === 200) {
          Home.showToast?.('分类排序已保存');
          closeModal(categorySortModal);
          window.location.reload();
        } else {
          showMessage(categorySortMessage, data.message || '保存排序失败');
        }
      } catch (err) {
        console.error('保存分类排序失败:', err);
        showMessage(categorySortMessage, '网络错误，保存排序失败');
      } finally {
        btn.disabled = false;
      }
    });

    // 初始状态：仅显示编辑入口按钮
    editModeBtn.classList.remove('hidden');
    editModeBtn.classList.add('flex');
  };
})();
