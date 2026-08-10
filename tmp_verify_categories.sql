SHOW CREATE TABLE kakeibo.categories;
SELECT id, name, HEX(name) AS hex_name FROM kakeibo.categories WHERE id >= 33 ORDER BY id;
