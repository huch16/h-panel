# 🚀 h-panel · 灰色轨迹

> **轻量、私密、零服务器成本** 的个人书签 / 网址导航平台，基于 **Cloudflare Pages + Workers + D1 + KV**，内置 **Workers AI** 自动生成站点描述。

![Screenshot](image/screenshot.png) <!-- 替换为真实截图 -->

---

## ✨ 特性

- **响应式布局**（支持暗色模式）  
- **首页 SSR + KV 边缘缓存**（毫秒级响应）  
- **AI 自动生成**（Workers AI / Gemini / OpenAI）  
- **访客投稿**（可关闭）+ Cloudflare Turnstile 人机验证  
- **后台管理**（HttpOnly Cookie + CSRF）  
- **批量管理、导入 / 导出**（兼容 Chrome 书签 HTML）  
- **壁纸 & 卡片样式**自定义  
- **完整测试**（`node:test`）  
- **零服务器成本**（完全运行在 Cloudflare 免费套餐）

---

## 🚀 快速部署

### 1️⃣ Fork 仓库
点击右上角 **Fork** 将本仓库同步到你的 GitHub。

### 2️⃣ Cloudflare Pages 创建项目
- **Pages → Create a project → Connect to Git**  
- 选择刚才 Fork 的仓库  
- **Build command**：留空（`precommit` 会自动生成 `?v=` 哈希）  
- **Build output directory**：`public`

### 3️⃣ 绑定资源
| 资源 | 变量名 | 备注 |
|------|--------|------|
| **D1** (SQLite) | `NAV_DB` | 推荐名 `book` |
| **KV** | `NAV_AUTH` | 存储会话、限流、缓存标记 |
| **Workers AI** | `AI` | 启用 AI 描述生成（可选） |

> **Workers AI** 只需在 Cloudflare Dashboard → **Workers AI** 页面打开即可使用，无需额外资源。

### 4️⃣ 配置管理员账号（KV）
在 KV 命名空间 `NAV_AUTH` 中写入：

```bash
wrangler kv:key put --binding=NAV_AUTH admin_username "your_admin"
wrangler kv:key put --binding=NAV_AUTH admin_password "your_password"
```

### 5️⃣ 部署
点击 **Save and Deploy**，稍等片刻即可在 `https://<your-project>.pages.dev` 访问。

---

## 🛠️ 本地运行

```bash
# 1. 克隆仓库
git clone git@github.com:huch16/h-panel.git
cd h-panel

# 2. 安装依赖
npm install

# 3. 复制示例 wrangler 配置
cp wrangler.example.toml wrangler.toml
# 按需求编辑 `wrangler.toml`（绑定 D1、KV、AI）

# 4. 初始化本地 D1
npx wrangler d1 execute book --local --file=schema.sql

# 5. 启动开发服务器
npm run dev
```

访问 `http://localhost:8788` 预览。

---

## 🤖 使用 Workers AI 自动生成描述

1. 在 `wrangler.toml` 中确保已启用 AI 绑定：

```toml
[ai]
binding = "AI"
remote = false
```

2. 登录后台 → **编辑书签** → 点击 **“AI 生成描述”** 按钮，系统会调用 `env.AI.run`（默认 `@cf/meta/llama-3.1-8b-instruct`），将返回的文本填入 **描述** 框。

3. 如需更换模型，只需在 `functions/lib/workers-ai-models.js` 中改：

```js
export const resolveWorkersAiModel = (env) =>
  env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
```

> 支持的模型列表请参考 [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/)。

---

## 🎨 UI 与主题

- **默认主题**：浅色 + 深色自动切换（`prefers-color-scheme`）  
- **卡片风格**：可在后台 **Settings → Card Style** 中切换（`simple` / `compact` / `detailed`）  
- **图标库**：已集成 **Font Awesome 6**（CDN），可在模板里直接使用 `<i class="fa-solid fa-link"></i>`  
- **壁纸**：后台 **Settings → Wallpaper** 上传或填写 URL，前端通过 `background-image` 应用  
- **响应式**：Tailwind 自适应，手机端单列、平板两列、PC 三列

如需自定义样式，直接编辑 `public/css/tailwind.css`（源码）或 `tailwind.config.js` 后 `npm run build:css`。

---

## ⚙️ 环境变量

| 名称 | 必填 | 说明 |
|------|------|------|
| `ENABLE_PUBLIC_SUBMISSION` | ❌ | `true`/`false`，开启访客投稿 |
| `SITE_NAME` | ❌ | 站点名称（默认 “灰色轨迹”） |
| `SITE_DESCRIPTION` | ❌ | 站点副标题 |
| `FOOTER_TEXT` | ❌ | 页脚自定义文字 |
| `ICON_API` | ❌ | 站点图标获取接口（默认 `https://faviconsnap.com/api/favicon?url=`） |
| `AI_REQUEST_DELAY` | ❌ | AI 请求间隔（毫秒，默认 1500） |
| `WORKERS_AI_MODEL` | ❌ | Workers AI 默认模型 |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ❌ | Cloudflare Turnstile 人机验证 |

---

## 🧪 测试

```bash
npm run check   # 语法检查 + 运行 node:test
npm test        # 完整测试套件
```

测试覆盖了 **缓存、CSRF、限流、AI 描述** 等关键逻辑，确保改动安全。

---

## 📦 目录结构

```
h-panel/
├─ functions/          # Pages Functions（API、AI、后台）
│  ├─ api/            # RESTful 接口
│  └─ lib/            # 业务逻辑、Schema 迁移、Workers AI 模型解析
├─ public/            # 静态资源（HTML、Tailwind 编译产物、JS）
├─ scripts/            # 辅助脚本（版本哈希、CHANGELOG 自动生成）
├─ test/              # node:test 用例
├─ schema.sql         # D1 数据库结构
├─ tailwind.config.js # Tailwind 主题配置
├─ wrangler.example.toml # 示例 wrangler 配置
└─ README.md          # 本文件
```

---

## 🛡️ 安全

- **CSRF**：登录后写入 `csrf_{token}` 到 KV，所有写接口必须携带 `X-CSRF-Token` 校验。  
- **登录限流**：失败 5 次/10 分钟（KV 计数器）。  
- **时序安全**：使用 `timingSafeEqual` 比较凭据。  
- **CSP & XSS**：HTML 输出统一 `escapeHTML`、URL `sanitizeUrl`（仅 http/https），CSP 在 `public/_headers` 中声明。  
- **HttpOnly Cookie**：会话 Cookie `Secure; HttpOnly; SameSite=Lax`。

---

## 📜 许可证

MIT © 2024-2026 huch16

> 参考项目： [jy02739244/iori-nav](https://github.com/jy02739244/iori-nav) · 基于 Cloudflare 全家桶构建 🚀