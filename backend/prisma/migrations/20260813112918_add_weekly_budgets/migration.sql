-- CreateTable
CREATE TABLE `weekly_budgets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `year` SMALLINT NOT NULL,
    `month` TINYINT NOT NULL,
    `week_no` TINYINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `budget_amount` DECIMAL(10, 0) NOT NULL DEFAULT 0,

    UNIQUE INDEX `weekly_budgets_household_id_year_month_week_no_category_id_key`(`household_id`, `year`, `month`, `week_no`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `weekly_budgets` ADD CONSTRAINT `weekly_budgets_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_budgets` ADD CONSTRAINT `weekly_budgets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
