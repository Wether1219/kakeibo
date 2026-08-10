SELECT id, name, HEX(name) AS hex_name,
  CONVERT(name USING latin1) AS fixed_name,
  HEX(CONVERT(name USING latin1)) AS fixed_hex
FROM kakeibo.categories
WHERE id >= 33
ORDER BY id;
