-- 验证logo更新结果
SELECT 
  id,
  name,
  logo,
  CASE 
    WHEN logo LIKE '%nav.whohai.cfd/image/icons/%' THEN '自制图标'
    WHEN logo LIKE '%faviconsnap.com%' THEN 'faviconsnap'
    ELSE '其他'
  END as logo_type
FROM bookmark 
WHERE id IN (
  1,3,4,6,15,16,17,23,25,26,28,29,31,32,33,35,36,37,39,41,42,43,
  2,5,7,8,9,10,12,13,14,18,19,20,21,22,24,30,34,38,40
) -- 所有已知ID
ORDER BY id;
