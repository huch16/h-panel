# 灰色轨迹 — 轻量且安全的书签导航（Cloudflare 原生部署）

<p align="center">
  一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全运行在 Cloudflare 全家桶：Pages + Pages Functions（Workers）+ D1 + KV。
</p>

<p align="center">
  <strong>运行平台：</strong>Cloudflare Pages + Pages Functions（Workers） + D1（SQLite） + KV  
  <strong>语言：</strong>原生 JavaScript（ES Modules，非 TypeScript）  
  <strong>前端：</strong>服务端渲染模板替换（SSR 模板填充），非 SPA。  
  <strong>样式：</strong>TailwindCSS（产物在 public）
</p>

---

目录
- 核心特性
- 架构要点（必须了解）
- 快速部署（Cloudflare Pages）
- 本地开发
- 常用命令
- 环境变量与绑定说明
- 常见问题与排查
- 更新日志（摘要）
- 贡献与许可证
- 联系方式

---

## ✨ 核心���性

- 响应式、简洁美观的书签展示与多种卡片风格
- 服务端渲染首页模板 + KV HTML 缓存（边缘命中，极快加载）
- 后台管理（基于 KV 的认证与 HttpOnly 会话 Cookie）
- 访客投稿（可配置开/关）与投稿审核流程
- 私密书签与分类（支持公私分离与缓存隔离）
- D1（SQLite）作为主要数据存储，所有查询使用参数绑定，防注入
- AI 描述自动生成（支持 Workers AI / Google Gemini / OpenAI）
- 导入/导出（兼容 Chrome 导出的书签 HTML）
- 简单的本地测试（node:test）与 Tailwind 构建

---

## ⚙️ 架构要点（必须理解的大局）

1. 三套并存的“版本机制”（切勿混用）
   - SCHEMA_VERSION：触发 D1 schema 迁移（改表/字段/索引时手动 +1）
   - HOME_CACHE_VERSION：控制首页 HTML KV 缓存强制刷新
   - 静态资源 ?v=hash：浏览器缓存标识，由 pre-commit 脚本自动更新（不要手动改）

2. 运行时 Schema 迁移
   - 入口：`functions/lib/schema-migration.js` 的 `ensureSchemaReady()`。
   - 由 `_middleware.js` 在除首页 GET 以外的路径上触发 await，以保证首次非首页请求会做迁移检查；首页 GET 与 KV 并行以减少延迟。
   - 迁移成功后写入 KV 标记 `schema_migrated_{SCHEMA_VERSION}`，冷启动只需一次 KV 判断。
   - 新增字段/索引需在 `runIncrementalMigrations()` 中追加 `ALTER` 语句，并把 SCHEMA_VERSION（及 PREVIOUS_SCHEMA_VERSION）一起 +1。

3. 首页为 SSR 模板 + KV HTML 缓存（不是静态 HTML）
   - `public/index.html` 是模板，`functions/index.js` 负责渲染并替换 `{{PLACEHOLDER}}`。
   - 公私两份缓存 key 示例：`home_html_public_v{N}` / `home_html_private_v{N}`（通过 `getHomeCacheKey(scope)` 生成）。
   - 写操作（增删改 site/category/settings）必须调用 `markHomeCacheDirty(env, scope)` 标记脏，下一次 GET 会重渲染并替换缓存；写操作不要直接删除缓存以避免竞态。

4. 中间件：认证 / CSRF / 防爆破
   - 登录走表单 POST，成功后写 `admin_session=<uuid>; HttpOnly; Secure; SameSite=Lax`，会话数据存在 KV（`session_{token}`），TTL 可选 1/7/30/60/90 天。
   - CSRF：登录同时生成 `csrf_{token}` 并写入 KV；`/api/*` 的写操作强制校验 `X-CSRF-Token`（`/api/config/submit` 为匿名公开提交接口，改用 Origin/Referer 同源校验）。
   - 登录失败限流：`login_fail_{ip}`，5 次 / 10 分钟锁定。
   - 比较凭证时使用 `timingSafeEqual()` 防止时序攻击。

5. Settings 双层缓存（减少 D1 读）
   - `functions/api/settings.js` 写入时同时清除 `settings_cache`（KV）并标记 Home Cache dirty。
   - `functions/index.js` 读取时优先读取 `settings_cache`（24h TTL），若未命中再去 D1 并异步回填。

6. 私密书签 / 分类（is_private）
   - 未认证查询统一带 `WHERE (is_private = 0 OR ? = 1)`，由 `includePrivate = isAuthenticated ? 1 : 0` 绑定参数。
   - 分类 `is_private = 1` 时，相关站点会被强制置为私密。
   - 公私缓存互不污染，参见 `cacheScope` 与 `Set-Cookie iori_cache_*_stale`。

7. CSP / 输入清洗
   - HTML 输出统一使用 `lib/utils.js` 的 `escapeHTML` 转义。
   - 所有用户提供的 URL 必须过 `sanitizeUrl`（仅放行 http / https）。
   - 字体、颜色等样式项经过白名单校验（如 `FONT_MAP`）。
   - D1 操作统一使用参数绑定，防止 SQL 注入。

---

## 🚀 快速部署（Cloudflare Pages）

前提：需要一个 Cloudflare 账号并具备 Pages 项目权限。

1. Fork 本仓库到你的 GitHub 账号。
2. 在 Cloudflare Pages 新建项目，连接到你的 Fork：
   - 构建输出目录：`public`
   - 构建命令：默认（或留空视 Pages 设置）
3. 在 Cloudflare 控制台创建 D1 数据库（建议名为 `book`）。
4. 创建 Worker KV 命名空间（示例名：`NAV_AUTH`），并在 KV 中添加管理员凭证键：
   - `admin_username`
   - `admin_password`
5. 在 Pages 项目设置 -> 绑定 中添加：
   - D1 绑定：变量名 `NAV_DB`，选中你创建的 `book`
   - KV 绑定：变量名 `NAV_AUTH`，选中对应命名空间
   - （可选）Workers AI：变量名 `AI`（若需 AI 功能）
6. 部署并等待 Pages 完成构建；部署完成后为站点绑定自定义域（可选）。
7. 访问 `https://你的域名/admin` 进行后台登录配置。

---

## 🧪 本地开发

仓库包含 `wrangler.example.toml`，真实的 `wrangler.toml` 会被 .gitignore 忽略，请按需复制并填写资源 ID。

```bash
# 安装依赖（Tailwind / Husky）
npm install

# 复制本地 wrangler 配置并填写 D1 / KV / Wrangler 绑定
cp wrangler.example.toml wrangler.toml

# 构建 TailwindCSS（首次或修改 public/css/tailwind.css 后）
npm run build:css

# 启动本地开发（wrangler pages dev）
npm run dev

# （可选）在本地执行 D1 schema
npx wrangler d1 execute book --local --file=schema.sql
```

---

## 📦 常用命令

- npm install                # 安装依赖
- npm run build:css          # 构建 tailwind.min.css
- npm run dev:css            # Tailwind watch 模式
- npm run dev                # 启动 wrangler pages dev（predev 会先跑 scripts/update-versions.js）
- npm run check              # 语法检查 + node:test 测试
- npm test                   # 运行 node:test 测试
- npm run version            # 重新计算静态资源 ?v= 哈希（pre-commit 通常会自动运行）
- npm run changelog          # 根据 git log 更新 README 中的更新日志区块

D1（本地 / 远程）：
- npx wrangler d1 execute book --local  --file=schema.sql
- npx wrangler d1 execute book --remote --file=schema.sql

---

## 🔑 环境变量与绑定（Pages -> Bindings / Variables）

必需绑定（Pages 绑定）
- NAV_DB (D1) — 主数据库绑定（必需）
- NAV_AUTH (KV) — 会话、限流、缓存标记存储（必需）

可选绑定
- AI (Workers AI) — 使用 Workers AI 生成描述时需要绑定

可选环境变量（Pages -> Variables & Secrets）
- ENABLE_PUBLIC_SUBMISSION (默认 false) — 是否允许访客投稿
- SITE_NAME (默认 灰色轨迹) — 首页站点名称（DB settings 优先）
- SITE_DESCRIPTION — 首页副标题（DB settings 优先）
- FOOTER_TEXT — 页脚文案
- ICON_API (默认 https://faviconsnap.com/api/favicon?url=) — 补全 logo 的接口前缀
- AI_REQUEST_DELAY (默认 1500 ms) — AI 批量请求间隔
- WORKERS_AI_MODEL — Workers AI 模型（后台保存的模型优先）
- TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY — Cloudflare Turnstile 验证（启用登录与公开投稿人机验证）

配置优先级说明：
- 首页名称/副标题等优先读取数据库 settings，环境变量作为兜底。
- 静态资源版本 ?v=hash 由仓库脚本自动生成，不建议手动修改。

---

## ❗ 常见部署问题（快速排查）

- 无法登录 / 后台反复回到登录页：
  - 确认 `NAV_AUTH` KV 绑定是否存在且 KV 中包含 `admin_username` 与 `admin_password`。
  - 若启用 Turnstile，确认 TURNSTILE_SITE_KEY 与 TURNSTILE_SECRET_KEY 同时配置。
- 首页 500 或数据为空：
  - 确认 `NAV_DB` 绑定正确并已执行 `schema.sql`。
- 投稿入口不可见：
  - 确认 `ENABLE_PUBLIC_SUBMISSION=true`（字符串或布尔均可）。
- 修改 tailwind.css 无效：
  - 运行 `npm run build:css` 后重新部署。
- 迁移问题或 schema 不一致：
  - 检查 `SCHEMA_VERSION` 设置并确认 `functions/lib/schema-migration.js` 中的迁移是否已经应用。

---

## 📋 更新日志（摘要）
- 请查看仓库顶部 README 的 changelog 区块（已自动维护）。近期改动包括：
  - 新增卡片风格与壁纸支持（2026-07）
  - 后���会话安全改进：HttpOnly 会话 Cookie 与 CSRF 强化（2026-06）
  - 导入/导出与批量管理增强（2026-06）
  - 首页缓存与查询性能优化（2026-03 ~ 2026-04）

（完整更新记录请参见仓库 changelog 段落）

---

## 🤝 贡献

欢迎通过 Issue 或 Pull Request 参与贡献：

1. Fork 仓库
2. 新建分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -m "feat: ..." && git push origin feature/xxx`
4. 发起 Pull Request 描述你的变更与原因

贡献前请参考仓库中的 `AGENTS.md` 与代码注释以保持一致的运行时约定与迁移流程。

---

## 📄 许可证

本项目采用 MIT 许可证（LICENSE）。

---

## 📞 联系方式

- 项目源作者 / 参考仓库：[jy02739244/iori-nav](https://github.com/jy02739244/iori-nav)  
- 本仓库维护者：[@灰色轨迹](https://github.com/jy02739244)

<p align="center">如果你喜欢这个项目，请给它一个 ⭐️！</p>
