-- スキーマ: transactions テーブル
-- 実行例（ホストの mysql クライアント利用）:
-- mysql -h 127.0.0.1 -P 3306 -u root -p kakeibo < db/schema.sql
-- またはコンテナ内で:
-- docker exec -i kakeibo-mysql mysql -u root -p kakeibo < db/schema.sql

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1,
  `date` DATETIME NULL,
  `type` ENUM('income', 'expense') NOT NULL DEFAULT 'expense',
  category VARCHAR(100) NOT NULL DEFAULT 'その他',
  amount INT NOT NULL,
  memo TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_date (`date`),
  INDEX idx_type (`type`)
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_categories_user_id (user_id)
);
