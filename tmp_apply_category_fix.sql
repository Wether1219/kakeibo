SET NAMES utf8mb4;
SELECT 'before', id, name, HEX(name) AS hex_before FROM kakeibo.categories WHERE id >= 33 ORDER BY id;
UPDATE kakeibo.categories SET name = CONVERT(name USING latin1) WHERE id >= 33;
SELECT 'after', id, name, HEX(name) AS hex_after FROM kakeibo.categories WHERE id >= 33 ORDER BY id;
