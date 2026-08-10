SET NAMES utf8mb4;
UPDATE kakeibo.categories
SET name = CONVERT(name USING latin1)
WHERE id >= 33;
SELECT id, name FROM kakeibo.categories WHERE id >= 33 ORDER BY id;
