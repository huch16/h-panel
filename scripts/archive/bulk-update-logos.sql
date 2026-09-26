-- 批量替换现网书签logo为自制图标
-- 执行前请确认：
-- 1. 已部署最新版本（包含 /image/icons/ 目录）
-- 2. 图标文件已存在：01_ai_chip.png 到 10_star.png
-- 3. 建议先在测试环境或使用事务执行

-- 可选：用事务包装（如果D1支持）
-- BEGIN TRANSACTION;

-- 更新列表：(ID, 新LogoURL, 说明)
-- AI/机器学习相关 → 01_ai_chip.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 43; -- AI-gateway
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 37; -- gemini全模态
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 31; -- deep research web ui
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 32; -- 基于google的deep research
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 33; -- next chat webui
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/01_ai_chip.png' WHERE id = 35; -- webui

-- 搜索/资讯类 → 02_search.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/02_search.png' WHERE id = 41; -- searxng
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/02_search.png' WHERE id = 35; -- newsnow实时热门新闻

-- 视频媒体类 → 03_video.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/03_video.png' WHERE id = 36; -- moontv

-- 终端/开发工具类 → 04_terminal.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/04_terminal.png' WHERE id = 29; -- dcdeploy
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/04_terminal.png' WHERE id = 25; -- linux社区

-- 云服务类 → 05_cloud.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/05_cloud.png' WHERE id = 23; -- CloudPaste

-- 服务器管理类 → 06_server.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/06_server.png' WHERE id = 42; -- 1-panel
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/06_server.png' WHERE id = 39; -- Hermes

-- 机器人/自动化类 → 07_robot.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/07_robot.png' WHERE id = 26; -- qq机械人

-- 便签/笔记类 → 08_memo.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/08_memo.png' WHERE id = 28; -- memos

-- 网络/导航/社区类 → 09_globe.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/09_globe.png' WHERE id = 1;  -- 三维导航
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/09_globe.png' WHERE id = 3;  -- 万维网
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/09_globe.png' WHERE id = 4;  -- 网站导航
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/09_globe.png' WHERE id = 6;  -- 博谈网

-- 星标/收藏/推荐类 → 10_star.png
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/10_star.png' WHERE id = 15; -- serenity产业分析
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/10_star.png' WHERE id = 16; -- ETF策略
UPDATE bookmark SET logo = 'https://nav.whohai.cfd/image/icons/10_star.png' WHERE id = 17; -- 周末城市旅游攻略

-- 以下官方网站保留原有faviconsnap（官方favicon通常更好）：
-- youtube(2), oracle(38), amazon(18), cloudflare(20), huggingface(21), 腾讯云VPS(22),
-- gemini(24), notebooklm(14), grok(13), azure(12), railway(30), proton mail(7),
-- 微信网页版(8), github(9), cloudns(10), etc.

-- 提交事务
-- COMMIT;

-- 验证更新结果
-- SELECT id, name, logo FROM bookmark WHERE id IN (
--   1,3,4,6,15,16,17,23,25,26,28,29,31,32,33,35,36,37,39,41,42,43
-- ) ORDER BY id;
