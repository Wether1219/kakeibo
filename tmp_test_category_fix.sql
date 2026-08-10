SET NAMES utf8mb4;
START TRANSACTION;
SELECT id, name, HEX(name) AS hex_before, CONVERT(name USING latin1) AS conv1, HEX(CONVERT(name USING latin1) AS BINARY) AS hex_conv FROM kakeibo.categories WHERE id = 33;
UPDATE kakeibo.categories SET name = CAST(CONVERT(name USING latin1) AS BINARY) WHERE id = 33;
SELECT id, name, HEX(name) AS hex_after FROM kakeibo.categories WHERE id = 33;
ROLLBACK;
