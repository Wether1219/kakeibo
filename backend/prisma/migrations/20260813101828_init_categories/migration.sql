-- CreateTable
CREATE TABLE `households` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `household_id` BIGINT NOT NULL,
    `type` ENUM('income', 'pre_saving', 'fixed_expense', 'variable_expense') NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(10) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categories_household_id_type_name_key`(`household_id`, `type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
