SET NAMES utf8mb4;
SELECT id, name, HEX(name) AS hex_name,
  CONVERT(CAST(name AS BINARY) USING latin1) AS fixed,
  HEX(CONVERT(CAST(name AS BINARY) USING latin1)) AS fixed_hex
FROM kakeibo.categories
WHERE id = 33;
