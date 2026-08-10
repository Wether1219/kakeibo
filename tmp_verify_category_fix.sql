SET NAMES utf8mb4;
START TRANSACTION;
SELECT id, name, HEX(name) AS hex_name, CONVERT(name USING latin1) AS conv_name,
  HEX(CONVERT(name USING latin1)) AS conv_hex
FROM kakeibo.categories
WHERE id >= 33
ORDER BY id;
UPDATE kakeibo.categories
SET name = CONVERT(CONVERT(name USING latin1) USING utf8mb4)
WHERE id >= 33;
SELECT id, name, HEX(name) AS hex_name
FROM kakeibo.categories
WHERE id >= 33
ORDER BY id;
ROLLBACK;
