/**
 * admin-categories.js
 * 分类管理功能：列表展示、增删改查、排序
 */

// DOM Elements
const categoryGrid = document.getElementById('categoryGrid');
const categoryPrevPageBtn = document.getElementById('categoryPrevPage');
const categoryNextPageBtn = document.getElementById('categoryNextPage');
const categoryCurrentPageSpan = document.getElementById('categoryCurrentPage');
const categoryTotalPagesSpan = document.getElementById('categoryTotalPages');
const categoryPageSizeSelect = document.getElementById('categoryPageSizeSelect');
const addCategoryBtn = document.getElementById('addCategoryBtn');

// State
let categoryCurrentPage = 1;
let categoryPageSize = 10000; // Default show all for tree view structure
let categoryTotalItems = 0;
let currentViewParentId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCategoryEvents();
    // 初始加载由 tab 切换或 admin.js 触发
});

function initCategoryEvents() {
    // 树形总览模式：分页/每页条数不再适用，禁用相关控件
    if (categoryPageSizeSelect) {
        categoryPageSizeSelect.disabled = true;
        categoryPageSizeSelect.value = '10000';
    }

    if (categoryPrevPageBtn) categoryPrevPageBtn.disabled = true;
    if (categoryNextPageBtn) categoryNextPageBtn.disabled = true;

    // Add Category Button
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            // Populate dropdown with current tree
            // Ensure createCascadingDropdown is available (from admin.js)
            if (typeof window.createCascadingDropdown === 'function') {
                window.createCascadingDropdown('newCategoryParentWrapper', 'newCategoryParent', window.categoriesTree, '0');
            }
            const modal = document.getElementById('addCategoryModal');
            if (modal) {
                modal.style.display = 'block';
                document.body.classList.add('modal-open');
            }
        });
    }
}

// Global function to be called by Tab switching in admin.js
// 树形总览依赖全量分类数据，固定请求 pageSize=10000，禁用分页控件
window.fetchCategories = function(page = 1) {
    if (!categoryGrid) return;
    
    categoryGrid.innerHTML = '<div class="col-span-full text-center py-10">加载中...</div>';
    
    fetch(`/api/categories?page=1&pageSize=10000`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                categoryTotalItems = data.total;
                categoryCurrentPage = 1;
                
                if (categoryTotalPagesSpan) categoryTotalPagesSpan.innerText = '1';
                if (categoryCurrentPageSpan) categoryCurrentPageSpan.innerText = '1';
                
                // Update global data (defined in admin.js)
                window.categoriesData = data.data || [];
                
                // Rebuild Tree
                if (typeof window.buildCategoryTree === 'function') {
                    window.categoriesTree = window.buildCategoryTree(window.categoriesData);
                }
                
                renderCategoryView(currentViewParentId);
                updateCategoryPaginationButtons();
                
                // Also refresh dropdowns if they exist in other tabs (optional but good consistency)
                // We might need a global event or callback for this.
            } else {
                window.showMessage(data.message || '加载分类失败', 'error');
                categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
            }
        }).catch((err) => {
            console.error('Fetch Categories Error:', err);
            window.showMessage('网络错误: ' + err.message, 'error');
            categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
        });
};

function updateCategoryPaginationButtons() {
    if (categoryPrevPageBtn) categoryPrevPageBtn.disabled = true;
    if (categoryNextPageBtn) categoryNextPageBtn.disabled = true;
}

function renderCategoryView(parentId) {
    currentViewParentId = parentId;
    updateCategoryBreadcrumb(parentId);
    
    let nodesToRender = [];
    if (!parentId || parentId == '0') {
        nodesToRender = window.categoriesTree || [];
    } else {
        // Find the node in the tree
        const findNode = (nodes, id) => {
            for(const node of nodes) {
                if(node.id == id) return node;
                if(node.children) {
                    const found = findNode(node.children, id);
                    if(found) return found;
                }
            }
            return null;
        };
        const parentNode = findNode(window.categoriesTree, parentId);
        if(parentNode && parentNode.children) {
            nodesToRender = parentNode.children;
        } else {
            nodesToRender = [];
        }
    }
    renderCategoryTree(nodesToRender);
}

function updateCategoryBreadcrumb(parentId) {
    const backBtn = document.getElementById('categoryBackBtn');
    const breadcrumb = document.getElementById('categoryBreadcrumb');
    
    if(!parentId || parentId == '0') {
        if(backBtn) backBtn.classList.add('hidden');
        if(breadcrumb) breadcrumb.textContent = '顶级分类';
    } else {
        if(backBtn) backBtn.classList.remove('hidden');
        const cat = window.categoriesData.find(c => c.id == parentId);
        if(breadcrumb) breadcrumb.textContent = cat ? cat.catelog : '未知分类';
        
        if (backBtn) {
            backBtn.onclick = () => {
                 const currentCat = window.categoriesData.find(c => c.id == parentId);
                 if(currentCat && currentCat.parent_id && currentCat.parent_id != '0') {
                     renderCategoryView(currentCat.parent_id);
                 } else {
                     renderCategoryView(null);
                 }
            };
        }
    }
}

// 书签预览缓存：catelog_id -> sites[]
const categoryPreviewCache = new Map();

function renderCategoryTree(categories) {
    if (!categoryGrid) return;
    categoryGrid.innerHTML = '';
    if (!categories || categories.length === 0) {
        categoryGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">没有子分类数据</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    buildCategoryNodes(categories, frag);
    categoryGrid.appendChild(frag);

    bindCategoryEvents();
    setupCategoryDragAndDrop();
    loadAllCategoryPreviews();
}

// 递归构建分类卡片（子分类网格嵌套在父卡片内部，拖拽父卡片时整棵子树一起移动）
function buildCategoryNodes(categories, frag) {
    categories.forEach(item => {
        const card = buildCategoryCard(item);

        const children = item.children || [];
        if (children.length > 0) {
            const wrap = document.createElement('div');
            wrap.className = 'category-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mt-4 ml-4 pl-4 border-l-2 border-gray-100';
            const innerFrag = document.createDocumentFragment();
            buildCategoryNodes(children, innerFrag);
            wrap.appendChild(innerFrag);
            card.appendChild(wrap);
        }

        frag.appendChild(card);
    });
}

function buildCategoryCard(item) {
    const card = document.createElement('div');
    const safeName = window.escapeHTML(item.catelog);
    const siteCount = item.site_count || 0;
    const sortValue = item.sort_order === null || item.sort_order === 9999 ? '默认' : item.sort_order;
    const subCount = item.children ? item.children.length : 0;

    // Private Icon
    const privateIcon = item.is_private ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="私密分类"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>` : '';

    card.className = 'site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-visible relative cursor-move';
    card.draggable = true;
    card.dataset.id = item.id;
    card.dataset.sort = item.sort_order;

    card.innerHTML = `
            <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button class="category-edit-btn p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors" title="编辑" data-category-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button class="category-del-btn p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full transition-colors" title="删除" data-category-id="${item.id}" data-site-count="${siteCount}" data-sub-count="${subCount}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="p-5">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center min-w-0">
                        <h3 class="text-lg font-medium text-gray-900 truncate" title="${safeName}">${safeName}</h3>
                        ${privateIcon}
                    </div>
                    <span class="bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full border border-primary-100 flex-shrink-0 ml-2">ID: ${item.id}</span>
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mt-4 space-x-4">
                    <div class="flex items-center" title="直接包含的书签数">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span>${siteCount}</span>
                    </div>
                    <div class="flex items-center" title="子分类数量">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span>${subCount} 子分类</span>
                    </div>
                    <div class="flex items-center">
                        <span>排序: ${sortValue}</span>
                    </div>
                </div>

                <div class="category-preview mt-3 pt-3 border-t border-gray-100" data-preview-id="${item.id}">
                    <div class="flex items-center text-xs text-gray-400 mb-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 4h4a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h4m2 2a2 2 0 014 0m0 0V4h4" />
                        </svg>
                        书签预览
                    </div>
                    <div class="category-preview-list flex flex-wrap gap-1.5 text-xs text-gray-500 min-h-[1.25rem]">加载中...</div>
                </div>
                
                <div class="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                    <button class="category-subs-btn text-xs flex items-center px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors" data-category-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        管理子分类
                    </button>
                </div>
            </div>
        `;
    return card;
}

// 为所有已渲染分类卡片懒加载书签预览（最多 8 条，图标+名称，点击可打开）
// 使用并发池限制同时请求数，避免分类过多时打爆后端
const PREVIEW_CONCURRENCY = 6;
const previewQueue = [];
let previewRunning = 0;

function loadAllCategoryPreviews() {
    const containers = document.querySelectorAll('#categoryGrid .category-preview');
    containers.forEach(container => {
        const catId = container.dataset.previewId;
        if (categoryPreviewCache.has(catId)) {
            const listEl = container.querySelector('.category-preview-list');
            if (listEl) renderCategoryPreview(listEl, categoryPreviewCache.get(catId));
            return;
        }
        previewQueue.push({ catId, container });
    });
    pumpPreviewQueue();
}

function pumpPreviewQueue() {
    while (previewRunning < PREVIEW_CONCURRENCY && previewQueue.length > 0) {
        const job = previewQueue.shift();
        previewRunning++;
        loadCategoryPreview(job.catId, job.container).finally(() => {
            previewRunning--;
            pumpPreviewQueue();
        });
    }
}

async function loadCategoryPreview(catId, container) {
    const listEl = container.querySelector('.category-preview-list');
    if (!listEl) return;

    if (categoryPreviewCache.has(catId)) {
        renderCategoryPreview(listEl, categoryPreviewCache.get(catId));
        return;
    }

    try {
        const res = await fetch(`/api/config?catalogId=${encodeURIComponent(catId)}&pageSize=8`);
        const data = await res.json();
        const sites = (data.code === 200 ? (data.data || []) : []);
        categoryPreviewCache.set(catId, sites);
        if (listEl.isConnected) {
            renderCategoryPreview(listEl, sites);
        }
    } catch (err) {
        console.error('Load Category Preview Error:', err);
        if (listEl.isConnected) {
            listEl.textContent = '预览加载失败';
        }
    }
}

function renderCategoryPreview(listEl, sites) {
    if (!listEl || !listEl.isConnected) return;
    if (!sites || sites.length === 0) {
        listEl.textContent = '暂无书签';
        return;
    }

    listEl.innerHTML = sites.map(site => {
        const safeName = window.escapeHTML(site.name);
        const safeUrl = window.escapeHTML(window.normalizeUrl(site.url || site.link || ''));
        let logo = window.normalizeUrl(site.logo);
        if (!logo && site.url) {
            logo = `https://faviconsnap.com/api/favicon?url=${encodeURIComponent(site.url)}`;
        }
        const safeLogo = window.escapeHTML(logo);
        return `<a href="${safeUrl}" target="_blank" rel="noopener" draggable="false"
            class="inline-flex items-center gap-1.5 text-gray-600 hover:text-primary-600 bg-gray-50 hover:bg-primary-50 rounded px-2 py-1 transition-colors" title="${safeName}">
            <img src="${safeLogo}" alt="" class="w-4 h-4 rounded-sm flex-shrink-0" loading="lazy" onerror="this.style.visibility='hidden'">
            <span class="truncate max-w-[120px]">${safeName}</span>
        </a>`;
    }).join('');
}

function bindCategoryEvents() {
    document.querySelectorAll('.category-edit-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const categoryId = this.getAttribute('data-category-id');
            const category = window.categoriesData.find(c => c.id == categoryId);
            if (category) {
                document.getElementById('editCategoryId').value = category.id;
                document.getElementById('editCategoryName').value = category.catelog;
                const sortOrder = category.sort_order;
                document.getElementById('editCategorySortOrder').value = (sortOrder === null || sortOrder === 9999) ? '' : sortOrder;
                document.getElementById('editCategoryIsPrivate').checked = !!category.is_private;
                
                if (typeof window.createCascadingDropdown === 'function') {
                    window.createCascadingDropdown('editCategoryParentWrapper', 'editCategoryParent', window.categoriesTree, category.parent_id || '0', category.id);
                }

                document.getElementById('editCategoryModal').style.display = 'block';
                document.body.classList.add('modal-open');
            } else {
                window.showMessage('找不到分类数据', 'error');
            }
        });
    });

    document.querySelectorAll('.category-del-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const category_id = this.getAttribute('data-category-id');
            const siteCount = parseInt(this.getAttribute('data-site-count') || '0');
            const subCount = parseInt(this.getAttribute('data-sub-count') || '0');
            
            if (siteCount > 0) {
                window.showMessage(`无法删除：该分类包含 ${siteCount} 个书签`, 'error');
                return;
            }
            if (subCount > 0) {
                window.showMessage(`无法删除：该分类包含 ${subCount} 个子分类`, 'error');
                return;
            }
            
            if (!category_id) return;
            
            // 使用自定义模态框而不是原生 confirm
            const deleteModal = document.getElementById('deleteCategoryConfirmModal');
            if (deleteModal) {
                // 解绑旧事件（如果有）
                const confirmBtn = document.getElementById('confirmDeleteCategoryBtn');
                const cancelBtn = document.getElementById('cancelDeleteCategoryBtn');
                const closeBtn = document.getElementById('closeDeleteCategoryConfirmModal');

                const closeModal = () => {
                     deleteModal.style.display = 'none';
                     document.body.classList.remove('modal-open');
                };
                
                // 使用 cloneNode 快速清除所有 event listeners
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                
                newConfirmBtn.addEventListener('click', () => {
                     closeModal();
                     deleteCategory(category_id);
                });

                cancelBtn.onclick = closeModal;
                closeBtn.onclick = closeModal;
                deleteModal.onclick = (event) => {
                     if (event.target === deleteModal) closeModal();
                };
                
                deleteModal.style.display = 'block';
                document.body.classList.add('modal-open');
            } else if (confirm('确定删除该分类吗？')) {
                deleteCategory(category_id);
            }
        });
    });
  
    document.querySelectorAll('.category-subs-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const categoryId = this.getAttribute('data-category-id');
            renderCategoryView(categoryId);
        });
    });
}

function deleteCategory(id) {
    fetch('/api/categories/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }) // Logical delete or reset
    }).then(res => res.json()).then(data => {
        if (data.code === 200) {
            window.showMessage('删除成功', 'success');
            // Refresh categories and also bookmarks configs because dropdowns/counts might change
            fetchCategories();
            if (typeof fetchConfigs === 'function') fetchConfigs();
            if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
        } else {
            window.showMessage(data.message || '删除失败', 'error');
        }
    });
}

function setupCategoryDragAndDrop() {
    // 每个网格容器（categoryGrid 或 .category-children）是一个独立的同级排序组
    const groups = [categoryGrid, ...categoryGrid.querySelectorAll('.category-children')];
    let draggedItem = null;
    let draggedGroup = null;

    groups.forEach(group => {
        const cards = Array.from(group.children).filter(el => el.classList.contains('site-card'));

        cards.forEach(card => {
            card.addEventListener('dragstart', function (e) {
                // 只处理真正的源卡片（事件可能从嵌套子卡片冒泡上来）
                const source = e.target.closest('.site-card');
                if (source !== card) return;
                draggedItem = card;
                draggedGroup = group;
                card.classList.add('opacity-50', 'scale-95');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
            });

            card.addEventListener('dragend', function () {
                card.classList.remove('opacity-50', 'scale-95');
                draggedItem = null;
                draggedGroup = null;
                document.querySelectorAll('#categoryGrid .site-card').forEach(c => c.classList.remove('border-2', 'border-accent-500'));
            });

            card.addEventListener('dragover', function (e) {
                const target = e.target.closest('.site-card');
                if (draggedItem && draggedGroup === group && target && target !== draggedItem && group === draggedItem.parentElement) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    target.classList.add('border-2', 'border-accent-500');
                }
            });

            card.addEventListener('dragleave', function (e) {
                const target = e.target.closest('.site-card');
                if (target) target.classList.remove('border-2', 'border-accent-500');
            });

            card.addEventListener('drop', function (e) {
                e.preventDefault();
                const target = e.target.closest('.site-card');
                if (target) target.classList.remove('border-2', 'border-accent-500');

                // 仅允许同一层级组内拖拽排序
                if (!draggedItem || !target || target === draggedItem || draggedGroup !== group || draggedItem.parentElement !== group) return;

                const groupCards = Array.from(group.children).filter(el => el.classList.contains('site-card'));
                const draggedIdx = groupCards.indexOf(draggedItem);
                const droppedIdx = groupCards.indexOf(target);

                if (draggedIdx < droppedIdx) {
                    target.after(draggedItem);
                } else {
                    target.before(draggedItem);
                }

                saveCategorySortOrder(group);
            });
        });
    });
}

function saveCategorySortOrder(group) {
    const groupCards = Array.from(group.children).filter(el => el.classList.contains('site-card'));
    const items = [];

    groupCards.forEach((card, index) => {
        const id = Number(card.dataset.id);
        const newSortOrder = index + 1;
        const category = window.categoriesData.find(c => c.id == id);
        if (!category) return;

        items.push({
            id,
            sort_order: newSortOrder
        });
    });

    if (items.length > 0) {
        window.showMessage('正在保存分类排序...', 'info');
        fetch('/api/categories/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        })
            .then(res => res.json())
            .then(data => {
                if (data.code !== 200) {
                    window.showMessage(data.message || '分类排序失败', 'error');
                    return;
                }

                window.showMessage('分类排序已保存', 'success');

                items.forEach(item => {
                    const category = window.categoriesData.find(c => c.id == item.id);
                    if (category) {
                        category.sort_order = item.sort_order;
                    }
                });

                // Refresh to sync state
                fetchCategories();
                // Also refresh main config as order might affect things? Probably not but safe.
                if (typeof fetchConfigs === 'function') fetchConfigs();
            })
            .catch(err => window.showMessage('保存排序失败: ' + err.message, 'error'));
    }
}


// ========== 编辑分类功能 ==========
const editCategoryModal = document.getElementById('editCategoryModal');
const closeEditCategoryModal = document.getElementById('closeEditCategoryModal');
const editCategoryForm = document.getElementById('editCategoryForm');

const cancelEditCategoryBtn = document.getElementById('cancelEditCategoryBtn');
if (cancelEditCategoryBtn) {
  cancelEditCategoryBtn.addEventListener('click', () => {
    editCategoryModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  });
}

if (closeEditCategoryModal) {
    closeEditCategoryModal.addEventListener('click', () => {
        editCategoryModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });
}

if (editCategoryForm) {
    editCategoryForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const id = document.getElementById('editCategoryId').value;
        const categoryName = document.getElementById('editCategoryName').value.trim();
        const sortOrder = document.getElementById('editCategorySortOrder').value.trim();
        const parentId = document.getElementById('editCategoryParent').value;
        const isPrivate = document.getElementById('editCategoryIsPrivate').checked;

        if (!categoryName) {
            window.showMessage('分类名称不能为空', 'error');
            return;
        }

        // Check duplicate name (excluding self)
        const isDuplicate = window.categoriesData.some(category => category.catelog === categoryName && category.id != id);
        if (isDuplicate) {
            window.showMessage('该分类名称已存在', 'error');
            return;
        }

        const payload = {
            catelog: categoryName,
            parent_id: parentId,
            is_private: isPrivate
        };

        if (sortOrder !== '') {
            payload.sort_order = Number(sortOrder);
        }

        fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(res => res.json())
            .then(data => {
                if (data.code === 200) {
                    window.showMessage('分类更新成功', 'success');
                    editCategoryModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    fetchCategories(categoryCurrentPage);
                    // 刷新主界面数据（因为分类名可能变了）
                    if (typeof fetchConfigs === 'function') fetchConfigs();
                    if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
                } else {
                    window.showMessage(data.message || '分类更新失败', 'error');
                }
            }).catch(err => {
                window.showMessage('网络错误: ' + err.message, 'error');
            });
    });
}

// ========== 新增分类功能 ==========
const addCategoryModal = document.getElementById('addCategoryModal');
const closeCategoryModal = document.getElementById('closeCategoryModal');
const addCategoryForm = document.getElementById('addCategoryForm');

const cancelAddCategoryBtn = document.getElementById('cancelAddCategoryBtn');
if (cancelAddCategoryBtn) {
  cancelAddCategoryBtn.addEventListener('click', () => {
    addCategoryModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (addCategoryForm) addCategoryForm.reset();
  });
}

if (closeCategoryModal) {
    closeCategoryModal.addEventListener('click', () => {
        addCategoryModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        addCategoryForm.reset();
    });
}

// 提交新增分类表单
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const categoryName = document.getElementById('newCategoryName').value.trim();
        const sortOrder = document.getElementById('newCategorySortOrder').value.trim();
        const parentId = document.getElementById('newCategoryParent').value;
        const isPrivate = document.getElementById('newCategoryIsPrivate').checked;

        if (!categoryName) {
            window.showMessage('分类名称不能为空', 'error');
            return;
        }

        const payload = {
            catelog: categoryName,
            parent_id: parentId,
            is_private: isPrivate
        };

        if (sortOrder !== '') {
            payload.sort_order = Number(sortOrder);
        }

        fetch('/api/categories/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(res => res.json())
            .then(data => {
                if (data.code === 201 || data.code === 200) {
                    window.showMessage('分类创建成功', 'success');
                    addCategoryModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    addCategoryForm.reset();

                    fetchCategories();
                    // 刷新主界面数据（因为主界面数据也变了，比如下拉框需要更新）
                    if (typeof fetchConfigs === 'function') fetchConfigs();
                    if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
                } else {
                    window.showMessage(data.message || '分类创建失败', 'error');
                }
            }).catch(err => {
                window.showMessage('网络错误: ' + err.message, 'error');
            });
    });
}
