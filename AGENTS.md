# AGENTS.md

Coding conventions for AI coding assistants (Cursor, Copilot, OpenCode, …)
working on this repository.

For Claude Code–specific guidance, see [`CLAUDE.md`](./CLAUDE.md). For the
end-user / deployer-facing docs, see [`README.md`](./README.md).

> **仓库归属**：本仓库由 [@huch16](https://github.com/huch16) 个人维护，基于上游
> [jy02739244/iori-nav](https://github.com/jy02739244/iori-nav) 二次开发。

## Project overview

**h-panel · 灰色轨迹** is a personal bookmark / URL-navigation site built on
the Cloudflare full stack.

- **Language**: JavaScript (ES Modules, **no TypeScript**)
- **Platform**: Cloudflare Pages + Pages Functions + D1 + KV
- **Frontend**: Vanilla HTML/JS + TailwindCSS (home page is
  client-rendered after a single JSON fetch; admin is a multi-file vanilla SPA)
- **Testing**: Node.js built-in `node:test` (no external runner)
- **Linting**: none — `scripts/check-syntax.js` runs `node --check` on every
  `.js` / `.mjs`

## File layout (authoritative)

```
functions/
├── _middleware.js         # global middleware + shared helpers
├── constants.js           # SCHEMA_VERSION / HOME_CACHE_VERSION / DB_SCHEMA / FONT_MAP
├── admin/                 # login.js, logout.js, index.js (HTML shell + CSRF injection)
├── api/                   # REST endpoints
│   ├── home-data.js       # single JSON source for the home page
│   ├── settings.js / ai-chat.js / wallpaper.js / public-config.js …
│   ├── categories/        # index.js, create.js, reorder.js, [id].js
│   ├── config/            # index.js, batch.js, export.js, import.js, submit.js, [id].js
│   ├── pending/           # index.js, [id].js
│   ├── cache/             # clear.js
│   └── ai/                # generate-icon.js
└── lib/
    ├── card-model.js
    ├── schema-migration.js
    ├── settings-parser.js
    ├── utils.js
    ├── validators.js
    ├── wallpaper-defaults.js
    ├── wallpaper-fetcher.js
    ├── workers-ai-models.js
    ├── turnstile.js
    ├── bcrypt.js              # ES Module wrapper for password hashing
    └── bcrypt-vendor.js       # Vendored bcryptjs 2.4.3 (Apache-2.0); avoids Pages build dependency resolution

public/                    # Pages build output
├── index.html             # home shell (loads main.js → /api/home-data)
├── admin/index.html       # admin shell
├── _headers               # CSP + long-cache for static assets
├── css/                   # tailwind.css (source) + tailwind.min.css (build)
├── js/                    # home-*.js / main.js / admin-*.js
└── image/                 # shipped assets (fengge.jpg, icons/*.png)

scripts/
├── update-versions.js     # pre-commit: re-bake ?v=hash in HTML
├── update-changelog.js    # regenerate README changelog block
├── check-syntax.js        # node --check over every JS file
├── node-extensionless-loader.mjs  # test runner loader
└── archive/               # historical one-off migration scripts

test/                      # node:test suites (*.test.mjs)
schema.sql                 # D1 initial schema
wrangler.example.toml      # template for the gitignored wrangler.toml
tailwind.config.js         # theme tokens used by Tailwind build
```

## Development commands

```bash
npm install                # install dev deps
npm run dev                # wrangler pages dev (predev re-bakes ?v= hashes)
npm run dev:css            # Tailwind watch mode (separate terminal)
npm run build:css          # rebuild tailwind.min.css
npm test                   # run all node:test suites
npm run check:syntax       # syntax check every JS file
npm run check              # syntax check + tests
npm run version            # re-bake ?v= hashes manually
npm run changelog          # regenerate README changelog

# D1
npx wrangler d1 execute book --local  --file=schema.sql
npx wrangler d1 execute book --remote --file=schema.sql
```

**Version hashes are auto-managed.** pre-commit hook (`scripts/update-versions.js`)
computes MD5 of every CSS/JS file referenced by `index.html` / `admin/index.html`
and rewrites the `?v=…` query. Do not hand-edit.

## Coding style

### Naming

- **Files**: lowercase + hyphens (`ai-chat.js`); dynamic routes use square
  brackets (`[id].js`).
- **Functions**: `camelCase` (`isAdminAuthenticated`, `normalizeSortOrder`).
- **Constants**: `UPPER_SNAKE_CASE` (`HOME_CACHE_VERSION`, `INPUT_LIMITS`).
- **Booleans**: `is` / `has` prefix (`isValid`, `hasChildren`).

### File size

- New files should preferably stay **under 500 lines**. If a file is heading
  past that, split by responsibility first.

### Commit messages

- Chinese, brief, focus on **why** not what.

### Imports

```javascript
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';
import { normalizeBookmarkName, normalizeBookmarkUrl } from '../../lib/validators';
```

Cloudflare Pages Functions require ES Modules — never use `require()`.

### Response format

```javascript
// Success
return jsonResponse({ code: 200, data: results });

// Error
return errorResponse('Unauthorized', 401);
return errorResponse(`Failed to fetch: ${e.message}`, 500);
```

All API endpoints should funnel through these two helpers — they set the
correct `Content-Type` and `Cache-Control: no-store`.

### Authentication check (admin endpoints)

```javascript
if (!(await isAdminAuthenticated(request, env))) {
  return errorResponse('Unauthorized', 401);
}
```

Middleware will additionally validate the `X-CSRF-Token` header on every
state-change request, so this check is mostly belt-and-braces for GET
endpoints that must exclude private content from anonymous callers.

### Required security helpers

Always escape on the way out:

```javascript
// HTML escape — use before any innerHTML / SSR string concat
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// URL allowlist — http/https only, blocks javascript:, data:, file:, …
function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}
```

The canonical versions live in `functions/lib/utils.js`. Don't reimplement —
import them.

## Database

Always use parameter binding — never string-concat user input into SQL.

```javascript
const { results } = await env.NAV_DB
  .prepare('SELECT * FROM sites WHERE catelog_id = ?')
  .bind(categoryId)
  .all();

const site = await env.NAV_DB
  .prepare('SELECT * FROM sites WHERE id = ?')
  .bind(id)
  .first();

await env.NAV_DB
  .prepare('DELETE FROM sites WHERE id = ?')
  .bind(id)
  .run();
```

For batch operations use `.batch([...])`. For LIKE queries wrap user input in
`escapeLikePattern()` to neutralise `%` / `_` / `\` wildcards.

## Frontend conventions

- **Vanilla JS, no bundler.** Each file in `public/js/` is loaded directly by
  the browser; it can rely on the cache-busted `?v=…` query in the HTML.
- **Use optional chaining** for nullable DOM nodes:
  `sidebar?.classList.add('open')`.
- **Use textContent** for any user-controlled text. If you must use
  `innerHTML`, compose from already-escaped pieces.
- **Toast helper**: most admin pages already have one — call
  `Home.showToast?.('message')` from any non-home page.

## Environment variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NAV_DB` | — (required) | D1 binding |
| `NAV_AUTH` | — (required) | KV binding |
| `ENABLE_PUBLIC_SUBMISSION` | `false` | Toggle public submit endpoint |
| `SITE_NAME` | `湖海的自由天空` | Site title in SSR / meta |
| `SITE_DESCRIPTION` | `有轨电车旁的苦菊` | Subtitle / meta description |
| `FOOTER_TEXT` | `曾梦想仗剑走天涯` | Footer caption |
| `ICON_API` | `https://faviconsnap.com/api/favicon?url=` | Favicon resolver |
| `AI_REQUEST_DELAY` | `1500` | Min ms between AI requests |
| `WORKERS_AI_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | Default Workers AI model |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | unset | Cloudflare Turnstile (both required to enable) |

> Legacy `DISPLAY_CATEGORY` is no longer read.

## Database schema migration

Project uses **runtime migration** via D1 — no external migration tool.

### How it works

- Migration logic: `functions/lib/schema-migration.js::ensureSchemaReady()`
- Version constant: `functions/constants.js::SCHEMA_VERSION`

```javascript
// Bump this constant whenever you add a column / index / table
export const SCHEMA_VERSION = 'v5';
```

- On successful migration, KV stores `schema_migrated_{SCHEMA_VERSION}`
  (long-lived). Cold starts need just one KV read to short-circuit.

### Adding a new column

1. Append the `ALTER` to `runIncrementalMigrations()`.
2. Bump `SCHEMA_VERSION` (and `PREVIOUS_SCHEMA_VERSION` for cleanup).
3. Deploy. First request after deploy runs the migration automatically.

### Example

```javascript
// 1. Bump the version
export const SCHEMA_VERSION = 'v6';
export const PREVIOUS_SCHEMA_VERSION = 'v5';

// 2. Add the new column
if (!sitesCols.has('new_column')) {
  alterStatements.push(env.NAV_DB.prepare(
    "ALTER TABLE sites ADD COLUMN new_column TEXT"
  ));
}
```