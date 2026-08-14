-- AlterTable
ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN `password_hash` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN `color_code` VARCHAR(7) NULL;

-- 既存行に開発用の仮アカウントを設定（本番投入データではないため上書き可。パスワードは kakeibo1234）
UPDATE `users` SET `email` = CONCAT('user', `id`, '@example.com'), `password_hash` = '$2b$10$ko6lP5hIy6TCO9CdxyAQy.zoSUckDLQHc/7n7mjSz6jcoKOoB9Gy2' WHERE `email` IS NULL;
UPDATE `users` SET `email` = 'taiyo@example.com' WHERE `id` = 999996;
UPDATE `users` SET `email` = 'mirano@example.com' WHERE `id` = 999997;

-- NOT NULL化・ユニーク制約
ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(255) NOT NULL;
ALTER TABLE `users` MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL;
ALTER TABLE `users` ADD UNIQUE INDEX `users_email_key`(`email`);
