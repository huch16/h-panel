# CLAUDE.md

Guidance for [Claude Code](https://claude.ai/code) when working on this repository.

This file is **Claude Code–specific**. For the full set of coding conventions
(naming, file size, imports, security helpers, schema migrations), see
[`AGENTS.md`](./AGENTS.md).

> **仓库归属**：本仓库由 [@huch16](https://github.com/huch16) 个人维护，基于上游
> [jy02739244/iori-nav](https://github.com/jy02739244/iori-nav) 二次开发。

---

## Project overview

**h-panel · 灰色轨迹** is a personal bookmark / URL-navigation site that runs
**entirely on the Cloudflare free tier**.

| Concern | Stack |
| :--- | :--- |
| Runtime | Cloudflare Pages + Pages Functions (Workers) |
| Storage | D1 (SQLite) + KV |
| AI | Workers AI (default), with Gemini / OpenAI adapters |
| Frontend | Vanilla JS + TailwindCSS, SSR-first (home) + client-rendered lists |
| Testing | Node's built-in `node:test` (no third-party runner) |
| Lint | None — `scripts/check-syntax.js` does a `node --check` over every JS file |
| Auth | HttpOnly session cookie + CSRF token (Synchronizer Token Pattern) |

`AGENTS.md` is the source of truth for coding conventions — please read it
before editing.

## Common commands

```bash
npm install                # install dev deps (Tailwind, Husky, wrangler)
npm run dev                # wrangler pages dev (predev runs update-versions.js first)
npm run dev:css            # Tailwind watch mode
npm run build:css          # rebuild tailwind.min.css after editing tailwind.css
npm test                   # run all node:test suites
npm run check:syntax       # node --check over every .js/.mjs file
npm run check              # syntax check + tests
npm run version            # manually re-bake ?v=hash query params
npm run changelog          # regenerate the changelog block in README

# D1 (local / remote)
npx wrangler d1 execute book --local  --file=schema.sql
npx wrangler d1 execute book --remote --file=schema.sql
```

`wrangler.toml` is gitignored — copy `wrangler.example.toml` and fill in your
own D1/KV IDs on first checkout.

## Architecture — three coexisting "version" mechanisms

Do **not** conflate these. They serve different purposes:

| Name | Purpose | When to bump |
| :--- | :--- | :--- |
| `SCHEMA_VERSION` (in `functions/constants.js`) | Triggers D1 schema migration | Adding a column / index / table |
| `HOME_CACHE_VERSION` (in `functions/constants.js`) | Busts the home-page KV cache | Changing home page structure |
| `?v=hash` on static asset URLs | Browser cache busting | **Never manual** — auto-baked by `scripts/update-versions.js` (pre-commit hook) |

### Runtime schema migration

- Entry point: `functions/lib/schema-migration.js::ensureSchemaReady()`
- `_middleware.js` `await`s it on every non-home-GET path; the home GET path
  parallelises it with KV reads to avoid extra latency on cache HIT.
- On success, KV stores `schema_migrated_{SCHEMA_VERSION}` (long-lived). Cold
  starts need only one KV read to short-circuit.
- **Adding a column**: append an `ALTER` to `runIncrementalMigrations()`,
  bump `SCHEMA_VERSION` (and `PREVIOUS_SCHEMA_VERSION` for cleanup), deploy.

### Home page is client-rendered, not SSR-template

The earlier `functions/index.js` + `{{PLACEHOLDER}}` template pipeline was
removed. The current pipeline is:

1. Browser hits `/` → static `public/index.html` is served.
2. `public/js/main.js` fetches `GET /api/home-data`.
3. `functions/api/home-data.js` returns JSON `{ sites, categories, settings, csrf, theme, head }`.
4. `public/js/home-render.js` paints the cards; admin features mount from
   `public/js/home-edit.js` only when `meta[name="admin-authenticated"] === "true"`.

The CSRF token is delivered **inside** `/api/home-data` (not injected via HTML
string concat), so admin write endpoints stay protected without a second
round-trip.

## Auth / CSRF / rate-limit pipeline

All centralised in `functions/_middleware.js`:

- **Login** (form POST to `/admin/login`): on success writes
  `admin_session=<uuid>; HttpOnly; Secure; SameSite=Lax` cookie + KV
  `session_{token}`. TTL is user-selectable (1/7/30/60/90 days).
- **CSRF**: at login a `csrf_{token}` is also written to KV. Every state-change
  request to `/api/*` must carry `X-CSRF-Token` header. `/api/config/submit`
  (anonymous public submission) is the lone exception — it uses
  Origin/Referer same-host validation instead.
- **Login brute-force**: 5 failures per IP per 10 minutes (`login_fail_{ip}`).
- **String comparison** via `timingSafeEqual` to prevent timing attacks.
- **Rate-limit** `checkRateLimit()` is **fail-open** by design (KV outage
  should not block legitimate traffic). When `env.NAV_AUTH.put` is unavailable
  (test mocks), it returns allowed without logging to keep test output clean.

## Storage / caching model

| Layer | Used for |
| :--- | :--- |
| D1 `sites` / `category` / `pending_sites` / `settings` | Source of truth |
| KV `session_*` / `csrf_*` / `login_fail_*` | Auth state |
| KV `home_html_{scope}_v{HOME_CACHE_VERSION}` | Cached home HTML (write-on-miss, version-busted on dirty) |
| KV `home_dirty_*` | "cache is stale" flags; cleared on next successful render |
| KV `settings_cache` | Read-through cache for settings (24h TTL) |

`markHomeCacheDirty(env, scope)` must be called on **every** write that
affects what the home page renders, otherwise the cached HTML stays stale.

## Privacy model

- Anonymous requests see only `is_private = 0` rows.
- Authenticated admins see everything (`includePrivate = 1`).
- If a category is private, `api/config/index.js` forces new bookmarks added
  under it to also be private.
- Public/private caches are kept in **separate KV keys** so private content
  can never leak via the public cache.

## Input sanitisation

| Concern | Helper | Where |
| :--- | :--- | :--- |
| HTML escape | `escapeHTML()` | `functions/lib/utils.js` |
| URL allowlist (http/https only) | `sanitizeUrl()` | `functions/lib/utils.js` |
| CSS colour / size | `sanitizeStyleColor()` / `sanitizeStyleSize()` | `functions/lib/utils.js` |
| Font name (whitelist) | `getStyleStr()` checks `FONT_MAP` | `functions/lib/utils.js` |
| Text length | `INPUT_LIMITS` + `normalize*Text()` | `functions/lib/validators.js` |
| LIKE wildcards | `escapeLikePattern()` | `functions/lib/utils.js` |
| Workers AI model id | `normalizeWorkersAiModel()` | `functions/lib/workers-ai-models.js` |
| Settings enum | `normalizeSettingValueForStorage()` | `functions/lib/settings-parser.js` |

D1 uses **parameter binding** (`prepare(...).bind(...)`) everywhere — no string
concat into SQL.

## File layout

```
functions/
├── _middleware.js         # global middleware + shared helpers (auth/CSRF/rate-limit/cache)
├── constants.js           # SCHEMA_VERSION / HOME_CACHE_VERSION / DB_SCHEMA / FONT_MAP
├── admin/                 # /admin (HTML shell + CSRF meta injection), /admin/login, /admin/logout
├── api/                   # REST endpoints (categories/, config/, pending/, cache/, settings.js, ai-chat.js, wallpaper.js …)
│   └── home-data.js       # the single JSON source for the home page
└── lib/                   # card-model, schema-migration, settings-parser, utils, wallpaper-fetcher, workers-ai-models, turnstile, **bcrypt (vendored)**

public/                    # Pages static output directory
├── index.html             # home shell (loads main.js → /api/home-data)
├── admin/index.html       # admin shell (CSRF meta injected by admin/index.js via placeholder)
├── _headers               # CSP + long-cache headers for static assets
├── css/                   # tailwind.css (source) + tailwind.min.css (build)
├── js/                    # home-*.js + main.js + admin-*.js
└── image/                 # shipped assets (e.g. fengge.jpg used by admin preview)

scripts/
├── update-versions.js     # pre-commit: MD5 → ?v=xxx in HTML
├── update-changelog.js    # regenerate README changelog block from git log
├── check-syntax.js        # node --check over every JS file
├── node-extensionless-loader.mjs  # test runner loader for extensionless imports
└── archive/               # one-off migration scripts kept for reference

schema.sql                 # D1 initial schema (runtime ensureSchemaReady adds subsequent ALTERs)
wrangler.example.toml      # template — copy to wrangler.toml (gitignored)
```

## Hard rules

- **Modify `public/css/tailwind.css` → `npm run build:css`** or you'll ship unstyled.
- **Any D1 write that affects home rendering → call `markHomeCacheDirty(env, scope)`** or KV cache will keep returning stale HTML.
- **Adding a setting field → register it in `lib/settings-parser.js` `SETTINGS_SCHEMA`** or the home page won't see it.
- **Don't manually edit `?v=` in HTML** — pre-commit hook will rewrite it.
- API file naming: dynamic routes use square brackets (`api/config/[id].js`, `api/categories/[id].js`).
- State-change endpoints expect JSON body + `X-CSRF-Token: <meta>` header (admin HTML injects it).

## Deployment bindings (Cloudflare Pages → Settings → Bindings)

| Binding | Type | Required |
| :--- | :--- | :--- |
| `NAV_DB` | D1 database (default name `book`) | ✅ |
| `NAV_AUTH` | KV (sessions / CSRF / rate-limit / settings cache / home HTML cache) | ✅ |

Admin credentials are stored as KV keys `admin_username` and `admin_password`.
Password can be either a bcrypt hash (`$2[aby]$…`) or legacy plaintext — the
login handler upgrades plaintext to bcrypt on first successful match.

### Vendored bcryptjs

`bcryptjs` 2.4.3 is **vendored** at `functions/lib/bcrypt-vendor.js` (Apache-2.0)
and re-exported via `functions/lib/bcrypt.js`. Cloudflare Pages' default build
configuration does NOT run `npm install` when no build command is set in the
Dashboard, which causes wrangler's bundler to fail with "Could not resolve
'bcryptjs'" during Functions bundling. Vendoring sidesteps the install step
entirely — no `dependencies` needed, no Dashboard changes required.

## Chinese support

Comments, user-facing strings, and commit messages may use Chinese. Keep
consistency with existing style.