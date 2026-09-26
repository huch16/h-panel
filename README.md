# h-panel · 灰色轨迹

> **轻量、私密、零服务器成本**的个人书签 / 网址导航平台
> 完整跑在 Cloudflare 免费套餐上：Pages + Functions + D1 + KV + Workers AI

> 📌 **仓库归属**：本仓库由 [@huch16](https://github.com/huch16) 个人维护，基于上游 [jy02739244/iori-nav](https://github.com/jy02739244/iori-nav) 二次开发；历史 commit 归属上游贡献者，新功能与运维由本人完成。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](#)
[![Node 20+](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](./package.json)
[![Tests](https://img.shields.io/badge/tests-57%20passing-brightgreen)](#-测试)

---

## 目录

- [这是什么](#这是什么)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [5 分钟部署](#5-分钟部署)
- [本地开发](#本地开发)
- [配置参考](#配置参考)
- [项目结构](#项目结构)
- [安全模型](#安全模型)
- [Workers AI 集成](#workers-ai-集成)
- [测试](#测试)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [致谢](#致谢)
- [许可证](#许可证)

---

## 这是什么

一个**完全自托管**的书签导航站：

- **数据存在你自己的 Cloudflare 账号**——没有第三方、没有 SaaS 锁定
- **零月度账单**——落在 Pages / D1 / KV / Workers AI 免费额度内
- **毫秒级响应**——首页 JSON 由 Pages Functions 服务端渲染，KV 边缘缓存
- **后台完善**——书签/分类的增删改查、拖拽排序、批量导入导出（兼容 Chrome HTML）
- **可选 AI**——Workers AI / Gemini / OpenAI 任选，自动生成书签描述或图标

适合一个人或小团队把"杂乱的浏览器书签"整理成**美观的私人入口页**。

## 核心特性

| | |
| :--- | :--- |
| 🌓 响应式 + 自动暗色 | 移动 1 列 / 平板 2 列 / PC 3 列，`prefers-color-scheme` 自动切换 |
| ⚡ 首页边缘缓存 | SSR + KV 双 scope 缓存（公/私分离），脏标记失效 |
| 🤖 Workers AI 描述 | 一键为书签生成中文短描述；支持自定义模型 |
| 🎨 三套卡片风格 | `style1` / `style2` / `style3`，可在后台实时预览切换 |
| 🖼 壁纸自定义 | 上传图片 / 填写 URL / 选择 Bing / 360 壁纸源 |
| 📨 访客投稿 | 可关闭；开启后用 Cloudflare Turnstile 防机器人 |
| 🔐 后台鉴权 | HttpOnly Cookie + CSRF Token + 登录限流 + bcrypt |
| 📦 导入导出 | 兼容 Chrome 书签 HTML；批量改 / 批量删 / 批量排序 |
| 🌐 i18n-ready | 所有文案与提交均 UTF-8，中文友好 |
| 🧪 内置测试 | `node:test`，15 个测试文件覆盖关键路径 |

## 技术栈

| 层 | 选型 | 备注 |
| :--- | :--- | :--- |
| 部署 | **Cloudflare Pages** | 静态资源 + Functions (Workers) |
| 数据库 | **D1** (SQLite) | 站点 / 分类 / 设置 / 待审核 |
| 缓存与会话 | **Workers KV** | session / CSRF / 限流 / 首页缓存 / settings 缓存 |
| AI | **Workers AI**（默认）+ Gemini / OpenAI 适配 | 见 [Workers AI 集成](#workers-ai-集成) |
| 前端 | 原生 JS + **TailwindCSS** | 无 SPA 框架，无打包器；首页 SSR 模板 + CSR 渲染 |
| 字体 | Google Fonts / fonts.loli.net | 白名单内可选 |
| 测试 | Node 内置 `node:test` | 无第三方依赖 |

---

## 5 分钟部署

### 前置条件

- 一个 Cloudflare 账号（[注册](https://dash.cloudflare.com/sign-up)）
- 一个 GitHub 账号（用来 fork）

### 步骤

#### 1. Fork 仓库

点击右上角 **Fork** → 同步到你的 GitHub。

#### 2. Cloudflare Pages 创建项目

1. Dashboard → **Workers / Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择你刚才 fork 的仓库
3. **Build command**：留空（不需要构建步骤；CSS 已预编译；`?v=` 哈希由 pre-commit hook 自动管理）
4. **Build output directory**：`public`
5. **Environment variables** 先留空（下一步绑定资源时再加）

#### 3. 绑定 Cloudflare 资源

在项目 → **Settings** → **Bindings** 添加：

| 类型 | 名称 | 备注 |
| :--- | :--- | :--- |
| **D1 database** | `NAV_DB` | 创建数据库，建议命名 `book`；记下 `database_id` |
| **KV namespace** | `NAV_AUTH` | 创建命名空间，记下 `id` |

如需 AI 描述生成，额外在 **Settings** → **Functions** → **AI binding** 添加：

| 类型 | 名称 |
| :--- | :--- |
| **Workers AI** | `AI` |

> Workers AI 无需额外资源；模型调用走 Cloudflare 计费（慷慨的免费额度）。

#### 4. 初始化 D1 schema

```bash
# 拉取 fork 到本地
git clone https://github.com/<你的用户名>/h-panel.git
cd h-panel

# 安装 wrangler（如未装）
npm install -g wrangler
wrangler login

# 把项目里的示例配置复制为本地配置
cp wrangler.example.toml wrangler.toml
# 编辑 wrangler.toml：填入上一步拿到的 database_id 与 KV id
```

```bash
# 远程执行 schema.sql
npx wrangler d1 execute book --remote --file=schema.sql
```

#### 5. 设置管理员账号

通过 KV 写入（用户名 + bcrypt 哈希后的密码）：

```bash
# 用户名
npx wrangler kv key put --binding=NAV_AUTH admin_username "your_admin" --remote

# 密码：先用 node 生成 bcrypt 哈希（saltRounds=10）
node -e 'console.log(require("bcryptjs").hashSync("your_password", 10))'

# 然后把上面的哈希粘贴进来
npx wrangler kv key put --binding=NAV_AUTH admin_password "$2a$10$..." --remote
```

> **也可先以明文写入**，首次成功登录后系统会自动升级为 bcrypt 哈希。

#### 6. 触发部署

回到 Cloudflare Pages → 项目 → **Deployments** → **Retry deployment**（或直接 push 一次 commit 触发）。

打开 `https://<your-project>.pages.dev` 即可看到首页；后台入口在 `/admin`。

---

## 本地开发

```bash
# 1. 克隆并装依赖
git clone https://github.com/huch16/h-panel.git
cd h-panel
npm install

# 2. 准备 wrangler.toml（指向本地 D1 / KV）
cp wrangler.example.toml wrangler.toml
# 编辑 wrangler.toml：database_id / kv id 都可以先用占位符
# wrangler pages dev 会自动用 .wrangler/state 下的本地 SQLite

# 3. 初始化本地 D1
npx wrangler d1 execute book --local --file=schema.sql

# 4. 写一组本地 admin 凭据
mkdir -p .wrangler/state/v3/d1
# 启动 dev server 后，在 UI 第一次登录时会创建 session

# 5. 启动开发服务器（predev 会自动跑 update-versions.js）
npm run dev
```

打开 <http://localhost:8788> 即可预览。修改 `functions/` 下的代码会自动重载；前端 JS/CSS 修改后浏览器可能需要刷新（`?v=` 由 pre-commit 自动更新，dev 模式下预跑一次保证一致）。

### 实时编译 TailwindCSS

单独开一个终端：

```bash
npm run dev:css
```

它会监听 `public/css/tailwind.css` 并实时输出到 `tailwind.min.css`。

---

## 配置参考

### 环境变量（Cloudflare Pages → Settings → Environment variables）

| 名称 | 默认 | 说明 |
| :--- | :--- | :--- |
| `ENABLE_PUBLIC_SUBMISSION` | `false` | `true` 开启首页"投稿"入口 |
| `SITE_NAME` | `湖海的自由天空` | 站点标题 |
| `SITE_DESCRIPTION` | `有轨电车旁的苦菊` | 站点副标题 / meta description |
| `FOOTER_TEXT` | `曾梦想仗剑走天涯` | 页脚文字 |
| `ICON_API` | `https://faviconsnap.com/api/favicon?url=` | 站点图标获取接口前缀 |
| `AI_REQUEST_DELAY` | `1500` | AI 请求最小间隔（毫秒） |
| `WORKERS_AI_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | 默认 Workers AI 模型 |

### Turnstile（可选）

| 名称 | 说明 |
| :--- | :--- |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile 站点 key |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret（仅后端用） |

两个都填了才启用。任一缺失则 `verifyTurnstileToken()` 直接放行。

### KV 键值（手动 `wrangler kv key put`）

| Key | Value | 用途 |
| :--- | :--- | :--- |
| `admin_username` | 字符串 | 后台登录用户名 |
| `admin_password` | bcrypt 哈希（或明文，首次登录后自动升级） | 后台登录密码 |

### D1 表

参见 [`schema.sql`](./schema.sql)。运行时迁移由 `functions/lib/schema-migration.js`
负责；新增列请同步 bump `functions/constants.js::SCHEMA_VERSION`。

---

## 项目结构

```
h-panel/
├─ functions/
│  ├─ _middleware.js        # 全局中间件：认证、CSRF、限流、缓存失效
│  ├─ constants.js          # SCHEMA_VERSION / HOME_CACHE_VERSION / DB_SCHEMA / FONT_MAP
│  ├─ admin/                # 后台入口：login / logout / index
│  ├─ api/                  # REST API（含 home-data 单源数据接口）
│  │  ├─ home-data.js       #   首页 JSON 数据源（替代旧 SSR + 模板占位符）
│  │  ├─ categories/        #   分类 CRUD
│  │  ├─ config/            #   书签 CRUD + 批量 + 导入导出 + 公开投稿
│  │  ├─ pending/           #   投稿审核
│  │  ├─ cache/             #   手动清缓存
│  │  ├─ ai/                #   Workers AI 生成图标
│  │  ├─ ai-chat.js         #   通用 AI 对话（描述生成等）
│  │  ├─ settings.js        #   设置读写
│  │  ├─ wallpaper.js       #   壁纸代理（Bing / 360）
│  │  ├─ public-config.js   #   给匿名访客的最小公开配置
│  │  └─ ...
│  └─ lib/                  # 共用：card-model / schema-migration / settings-parser / utils / wallpaper-fetcher / workers-ai-models / turnstile / validators
├─ public/                  # Pages 静态资源（构建输出目录）
│  ├─ index.html            # 首页 shell（加载 main.js → /api/home-data）
│  ├─ admin/index.html      # 后台 shell（CSRF token 通过占位符注入）
│  ├─ _headers              # CSP + 长缓存策略
│  ├─ css/                  # tailwind.css（源）+ tailwind.min.css（构建）
│  ├─ js/                   # main.js / home-*.js / admin-*.js
│  └─ image/                # 后台预览用的壁纸 + 导航图标
├─ scripts/
│  ├─ update-versions.js    # pre-commit：MD5 → ?v=xxx
│  ├─ update-changelog.js   # 根据 git log 更新下方更新日志区块
│  ├─ check-syntax.js       # node --check 全部 JS
│  ├─ node-extensionless-loader.mjs  # 测试运行 loader
│  └─ archive/              # 历史一次性脚本（仅供考古）
├─ test/                    # node:test 用例（15 个文件，57 个用例）
├─ schema.sql               # D1 初始建表
├─ tailwind.config.js
├─ wrangler.example.toml    # wrangler.toml 模板（wrangler.toml 已 gitignore）
├─ AGENTS.md                # AI 编码助手的代码风格指南
├─ CLAUDE.md                # Claude Code 专用说明
└─ README.md                # 本文件
```

---

## 安全模型

所有安全相关逻辑集中在 `functions/_middleware.js` 与 `functions/admin/login.js`。

### 认证与会话

- 登录走 form POST 到 `/admin/login`
- 成功后写入：
  - Cookie `admin_session=<uuid>; HttpOnly; Secure; SameSite=Lax`，TTL 1/7/30/60/90 天可选择
  - KV `session_{token}`（用于校验 cookie 是否仍有效，登出时立即删除）
- 登出删除 `session_*` 与 `csrf_*` 两个 KV 键

### CSRF（Synchronizer Token Pattern）

- 登录同时生成 `csrf_{token}` 写入 KV
- 后台 HTML 通过 `<!--CSRF_TOKEN-->` 占位符注入 `<meta name="csrf-token">`
- **所有** `/api/*` 的 `POST / PUT / DELETE / PATCH` 必须携带 `X-CSRF-Token: <token>` 头
- 例外：`/api/config/submit`（匿名公开投稿接口）使用 Origin / Referer 同源校验代替

### 速率限制与防爆破

- 登录失败计数 `login_fail_{ip}`：**5 次 / 10 分钟**锁定
- AI 对话 IP 限流 + session 限流（10/60s、200/24h）
- 公开投稿 IP 限流：5 次/分钟
- `checkRateLimit()` 设计为 **fail-open**：KV 不可达时不阻塞合法请求；mock 测试中不写日志

### 输入清洗

| 风险 | 防御 |
| :--- | :--- |
| XSS | 所有用户输入输出前 `escapeHTML()`；`public/index.html` 与 admin 严格使用 textContent 或转义后的 innerHTML |
| URL 注入 | `sanitizeUrl()` 仅放行 `http://` / `https://`，`javascript:` / `data:` 等子协议直接拒 |
| CSS 注入 | `sanitizeStyleColor()` 校验十六进制 / rgb() / 命名色；`sanitizeStyleSize()` 仅放行 8–96px 整数 |
| 字体滥用 | `getStyleStr()` 校验 font-family 命中 `FONT_MAP` 白名单 |
| 文本长度 | `INPUT_LIMITS` 在 `validators.js` 集中管理，书签名 ≤ 120、URL ≤ 2048、Logo ≤ 200000（含 base64 图）、描述 ≤ 1000 |
| SQL 注入 | 全部使用参数绑定；LIKE 查询用 `escapeLikePattern()` 转义 `%` / `_` / `\` |
| 时序攻击 | `timingSafeEqual()` 比较密码与 CSRF token |
| AI 注入 | `normalizeWorkersAiModel()` 校验模型 id 前缀与控制字符 |

### 私密数据隔离

- 匿名查询统一带 `WHERE (is_private = 0 OR ? = 1)`，绑定 `includePrivate = isAdminAuthenticated ? 1 : 0`
- 公私两套独立缓存键（`home_html_public_v{HOME_CACHE_VERSION}` / `home_html_private_…`），互不污染
- 分类为私密时，其下新增的书签自动设为私密

### 响应头

中间件统一追加：

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: interest-cohort=()`
- `Content-Security-Policy`（在 `public/_headers` 中声明）

---

## Workers AI 集成

### 默认模型

```javascript
// functions/lib/workers-ai-models.js
export const DEFAULT_WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
```

可在后台 **设置 → AI** 改用其他模型（保存到 `settings.model`），或用环境变量 `WORKERS_AI_MODEL` 做部署级兜底。

### 支持的服务商

| 服务商 | 触发条件 | 模型 |
| :--- | :--- | :--- |
| **Workers AI** | `provider = 'workers-ai'`（默认） | `@cf/google/gemma-4-26b-a4b-it` 或自定义 |
| **Gemini** | `provider = 'gemini'` + `apiKey` | 默认 `gemini-1.5-flash` |
| **OpenAI 兼容** | `provider = 'openai'` + `apiKey` + `baseUrl` | 默认 `gpt-3.5-turbo` |

密钥通过后台 **设置 → AI** 输入，永不回显到前端——只返回 `has_api_key: true/false`。

### 使用场景

1. **自动描述**：编辑书签 → 点 **AI 生成描述** → 调用 `ai-chat` 端点（responseFormat=`bookmark-description`）
2. **生成图标**：编辑书签 → 点 **AI 生成图标** → 调用 `ai/generate-icon` 端点（Stable Diffusion XL，返回 data:image/png;base64）

---

## 测试

```bash
npm test                 # 跑全部 57 个 node:test 用例
npm run check:syntax    # node --check 全部 .js / .mjs
npm run check           # 上面两个一起
```

测试用 `node --no-warnings --loader ./scripts/node-extensionless-loader.mjs` 运行
（自定义 loader 允许测试文件省略 `.js` 后缀 import）。

### 覆盖范围

| 模块 | 文件 |
| :--- | :--- |
| Admin 登录 | `test/admin-login.test.mjs` |
| 中间件（CSRF / 会话 / 限流 / 缓存） | `test/middleware.test.mjs` |
| API：AI 对话 | `test/api-ai-chat.test.mjs` |
| API：分类 | `test/api-categories-id.test.mjs` |
| API：书签 CRUD | `test/api-config-id.test.mjs` / `test/api-config-index.test.mjs` |
| API：导入 | `test/api-config-import.test.mjs` |
| API：公开投稿 | `test/api-config-submit.test.mjs` |
| API：审核 | `test/api-pending-id.test.mjs` |
| API：公开配置 | `test/api-public-config.test.mjs` |
| API：设置 | `test/api-settings.test.mjs` |
| 单元：settings-parser | `test/settings-parser.test.mjs` |
| 单元：utils | `test/utils.test.mjs` |
| 单元：validators | `test/validators.test.mjs` |
| 单元：wallpaper 默认值 | `test/wallpaper-defaults.test.mjs` |

未直接覆盖的端点：`api/ai/generate-icon.js`、`api/categories/reorder.js`、`api/config/export.js`（建议下个迭代补）。

### 持续集成建议

仓库里暂无 CI workflow。可在 `.github/workflows/ci.yml` 加一份：

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run check
```

---

## 常见问题

### Q: 部署后首页 502 / 500？

检查 Pages → 项目 → **Functions** → **Logs**。最常见原因：
- D1 / KV 绑定名打错（必须严格 `NAV_DB` / `NAV_AUTH`）
- 未执行 `schema.sql` 初始化数据库

### Q: 后台登录提示 "系统配置错误"？

KV 中 `admin_username` 或 `admin_password` 不存在，回到 [步骤 5](#5-设置管理员账号) 写入。

### Q: AI 描述按钮没反应？

1. 后台 → 设置 → AI → 确认 `provider` 已选（默认 `workers-ai`）
2. Cloudflare Pages → 项目 → **Settings** → **Functions** → **AI bindings** 已添加 `AI`
3. 在 Cloudflare Dashboard → **Workers AI** 页面确认已开通

### Q: 怎么改首页缓存策略？

调整 `functions/constants.js` 的 `HOME_CACHE_VERSION`（改完会强制刷新已缓存首页）；
`HOME_CACHE_TTL`（默认 30 天）。

### Q: 怎么自定义字体？

只有 `functions/constants.js::FONT_MAP` 白名单内的字体可被选用。要新增系统字体（无需外链）：
```js
FONT_MAP['"My Font", sans-serif'] = null;  // 系统已有
FONT_MAP['"My Font", sans-serif'] = 'https://example.com/font.css'; // 外链
```

### Q: 怎么备份数据？

```bash
# 导出所有书签 + 分类（admin → 导入导出，或直接走 API）
curl -H "Cookie: admin_session=$TOKEN" -H "X-CSRF-Token: $CSRF" \
  https://<your-project>.pages.dev/api/config/export > backup.json

# 导出 D1 全量
npx wrangler d1 export book --remote --output=book.sql
```

---

## 路线图

暂未实现 / 计划中：

- 🔍 站内全文搜索（D1 FTS5）
- 📱 PWA / Service Worker（离线访问）
- 🌗 多用户 / 协作权限
- 🌐 i18n（中 / 英）
- 🧩 浏览器扩展（一键加入书签）
- 📊 访问统计与点击排行

欢迎 PR——见 [致谢](#致谢)。

---

## 致谢

- 上游项目 [jy02739244/iori-nav](https://github.com/jy02739244/iori-nav)——本仓库的起点，感谢原作者的初始架构与设计思路
- Cloudflare 全家桶（Pages / Functions / D1 / KV / Workers AI）让"零服务器成本"成为可能
- [Font Awesome 6](https://fontawesome.com/) 提供图标

---

## 许可证

[MIT](./LICENSE) © 2024–2026 huch16

---

## 📋 更新日志

<!-- 此区块由 `npm run changelog` 自动维护，请勿手改日期格式 -->
<!-- changelog:start -->
- 🔧 **2026-09-26**：系统清理
- 📦 **2026-09-19**：增强导入导出与批量管理能力
- 📦 **2026-09-17**：增强导入导出与批量管理能力
- 🎨 **2026-09-16**：优化卡片样式与后台界面体验
- 🎨 **2026-08-25**：优化卡片样式与后台界面体验
- 🧰 **2026-08-09**：更新文档与部署使用说明
- 🎨 **2026-07-17**：优化卡片样式与后台界面体验
- 📂 **2026-07-14**：增强分类结构与私密数据支持，并优化界面交互
- 🔧 **2026-06-23**：清理 AI 设置调试日志
- 📂 **2026-06-21**：增强分类结构与私密数据支持
- 🛡️ **2026-06-20**：优化登录会话与安全防护
- 📦 **2026-06-09**：增强导入导出与批量管理能力
- 🎨 **2026-06-08**：优化卡片样式与后台界面体验
- 🎨 **2026-06-07**：优化卡片样式与后台界面体验
- ⚡ **2026-06-06**：优化缓存策略并提升加载性能
- 🎨 **2026-06-05**：优化卡片样式与后台界面体验
- 🔧 **2026-05-28**：拆分后台设置模块并补测试
- 🐞 **2026-05-06**：修复若干问题并提升稳定性
- 🐞 **2026-05-05**：修复若干问题并提升稳定性
- 🛡️ **2026-04-20**：优化登录会话与安全防护
<!-- changelog:end -->