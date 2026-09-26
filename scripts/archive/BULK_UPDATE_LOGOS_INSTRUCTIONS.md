# 批量更新书签logo为自制图标

## 前提条件

1. 已部署最新版本（包含客户端渲染器 refactor）
2. 图标文件已存在于 `/public/image/icons/` 目录：
   - 01_ai_chip.png ~ 10_star.png (共10个图标)
3. 有权限执行 D1 SQL（通过 wrangler 或 Cloudflare dashboard）

## 方法一：使用 Wrangler CLI（推荐）

如果您已在本地配置 wrangler 并登录：

```bash
# 1. 确保 wrangler.toml 中的 database_id 已填写
#    (参考 wrangler.example.toml 模板)

# 2. 执行更新（建议先在预览环境测试）
npx wrangler d1 execute book --file=scripts/bulk-update-logos.sql --remote

# 3. 验证更新结果
npx wrangler d1 execute book --file=scripts/verify-logo-updates.sql --remote
```

## 方法二：通过 Cloudflare Dashboard

1. 登录到 Cloudflare Dashboard
2. 进入 Workers & Pages → 您的 D1 数据库 (book)
3. 点击 "Console" 选项卡
4. 复制粘贴 `scripts/bulk-update-logos.sql` 的内容到查询编辑器
5. 点击 "Execute" 执行
6. 重复使用验证脚本确认结果

## 方法三：HTTP API（需要 API 令牌）

如果您有 Cloudflare API 令牌并知道数据库 ID：

```bash
# 获取数据库 ID 从 wrangler.toml 或 Cloudflare dashboard
DB_ID="your_database_id_here"
ACCOUNT_ID="99b808cf998f8e20c592966dc57da22a"  # 从环境变量获得

# 执行 SQL
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DB_ID/query" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"scripts/bulk-update-logos.sql"
```

## 更新映射说明

以下书签将获得自制图标：

| ID | 网站名称 | 新Logo | 说明 |
|----|----------|--------|------|
| 1 | 三维导航 | 09_globe.png | 网站导航类 |
| 3 | 万维网 | 09_globe.png | 小型导航站 |
| 4 | 网站导航 | 09_globe.png | GitHub Pages 导航 |
| 6 | 博谈网 | 09_globe.png | 技术社区/论坛 |
| 15 | serenity产业分析 | 10_star.png | 投资策略 GitHub repo |
| 16 | ETF策略 | 10_star.png | 投资策略 GitHub repo |
| 17 | 周末城市旅游攻略 | 10_star.png | 旅游攻略 GitHub repo |
| 23 | CloudPaste | 05_cloud.png | 自建云粘贴板 |
| 25 | linux社区 | 04_terminal.png | 技术社区论坛 |
| 26 | qq机械人 | 07_robot.png | QQ机器人自动化 |
| 28 | memos | 08_memo.png | 自建便签应用 |
| 29 | dcdeploy | 04_terminal.png | 部署工具命令行界面 |
| 31 | deep research web ui | 01_ai_chip.png | AI研究相关 |
| 32 | 基于google的deep research | 01_ai_chip.png | AI research Pages |
| 33 | next chat webui | 01_ai_chip.png | AI聊天界面 |
| 35 | webui | 01_ai_chip.png | AI相关Web UI |
| 36 | moontv | 03_video.png | 视频媒体平台 |
| 37 | gemini全模态 | 01_ai_chip.png | 自建Gemini接口 |
| 39 | Hermes | 06_server.png | 自建服务器管理面板 |
| 41 | searxng | 02_search.png | 私有搜索引擎 |
| 42 | 1-panel | 06_server.png | 服务器管理面板 |
| 43 | AI-gateway | 01_ai_chip.png | AI服务网关 |

以下官方网站保留原有faviconsnap（官方favicon通常质量更好）：
- YouTube(2), Oracle(38), Amazon(18), Cloudflare(20), HuggingFace(21), 腾讯云VPS(22)
- Gemini(24), NotebookLM(14), Grok(13), Azure(12), Railway(30), ProtonMail(7)
- 微信网页版(8), GitHub(9), CloudNS(10), 等

## 注意事项

1. **备份先行**：强烈建议在执行前使用以下命令备份当前状态：
   ```bash
   npx wrangler d1 export book --output=backup.sql --remote
   ```

2. **图片路径**：使用绝对 URL `https://nav.whohai.cfd/image/icons/...` 确保无论在哪个域名下都能正确加载。

3. **缓存更新**：更改后可能需要清除浏览器缓存或等待 CDN 刷新才能看到新图标。

4. **部分保留**：官方网站的原始 favicon 通常质量更好，因此保留未更新。

## 回滚说明

如果需要恢复到原始状态（所有使用 faviconsnap）：

```sql
-- 注意：此操作会将所有logo重置为faviconsnap URL
-- 仅在熟悉数据结构时使用，建议 вместо 从备份恢复
UPDATE bookmark SET logo = 
  'https://faviconsnap.com/api/favicon?url=' || 
  REPLACE(REPLACE(url, 'https://', ''), 'http://', '')
WHERE logo LIKE '%nav.whohai.cfd/image/icons/%';
```

但是，**强烈建议从备份恢复**而不是使用上述近似恢复，因为原始 URL 可能包含特殊路径。

## 执行确认

执行后，您可以访问 https://nav.whohai.cfd/ 观察首页图标变化。
自制图标将替换对应书签的显示图标。
