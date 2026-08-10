SET NAMES utf8mb4;
DELETE FROM kakeibo.categories WHERE name REGEXP '^\?+$';
SELECT id, name, HEX(name) AS hex_name FROM kakeibo.categories ORDER BY id;
