-- CreateTable
CREATE TABLE `incomes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `year` SMALLINT NOT NULL,
    `month` TINYINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `amount` DECIMAL(10, 0) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `incomes_household_id_year_month_user_id_category_id_key`(`household_id`, `year`, `month`, `user_id`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pre_savings` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `year` SMALLINT NOT NULL,
    `month` TINYINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `budget_amount` DECIMAL(10, 0) NOT NULL DEFAULT 0,
    `actual_amount` DECIMAL(10, 0) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pre_savings_household_id_year_month_user_id_category_id_key`(`household_id`, `year`, `month`, `user_id`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pre_savings` ADD CONSTRAINT `pre_savings_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pre_savings` ADD CONSTRAINT `pre_savings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pre_savings` ADD CONSTRAINT `pre_savings_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
