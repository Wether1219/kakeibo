SET NAMES utf8mb4;
SELECT id, name, HEX(name) AS hex_before,
  HEX(CONVERT(name USING latin1)) AS hex_conv1,
  HEX(CONVERT(CONVERT(name USING latin1) USING utf8mb4)) AS hex_conv2,
  CONVERT(CONVERT(name USING latin1) USING utf8mb4) AS text_conv2
FROM kakeibo.categories
WHERE id BETWEEN 33 AND 36
ORDER BY id;
