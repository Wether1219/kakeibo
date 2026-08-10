SET NAMES utf8mb4;
UPDATE kakeibo.categories SET name = CASE id
  WHEN 33 THEN '光熱費'
  WHEN 34 THEN '水道代'
  WHEN 35 THEN '通信費'
  WHEN 36 THEN 'サブスク'
  WHEN 37 THEN '奨学金'
  WHEN 38 THEN '保険'
  WHEN 39 THEN '住宅'
  WHEN 40 THEN '食費'
  WHEN 41 THEN '日用品'
  WHEN 42 THEN '雑費'
  WHEN 43 THEN '趣味・娯楽'
  WHEN 44 THEN '交際費'
  WHEN 45 THEN '衣服・美容'
  WHEN 46 THEN '健康・医療'
  WHEN 47 THEN '交通費'
  WHEN 48 THEN 'ふるさと納税'
END
WHERE id BETWEEN 33 AND 48;
SELECT id, name FROM kakeibo.categories WHERE id BETWEEN 33 AND 48 ORDER BY id;
