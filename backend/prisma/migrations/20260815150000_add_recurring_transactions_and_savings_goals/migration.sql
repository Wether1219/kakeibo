-- CreateTable
CREATE TABLE `recurring_transactions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `split_type` ENUM('self', 'shared') NOT NULL,
    `user_id` BIGINT NULL,
    `amount` DECIMAL(10, 0) NOT NULL,
    `memo` VARCHAR(255) NULL,
    `day_of_month` TINYINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `savings_goals` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `target_amount` DECIMAL(12, 0) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `recurring_transaction_id` BIGINT NULL;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `recurring_transactions_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `recurring_transactions_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `recurring_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `savings_goals` ADD CONSTRAINT `savings_goals_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_recurring_transaction_id_fkey` FOREIGN KEY (`recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
