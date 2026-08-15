-- AlterTable
ALTER TABLE `transactions`
    ADD COLUMN `settlement_payer_user_id` BIGINT NULL,
    ADD COLUMN `settlement_burden` ENUM('half', 'other_full') NULL,
    ADD COLUMN `settlement_partial_amount` DECIMAL(10, 0) NULL;

-- CreateIndex
CREATE INDEX `transactions_household_id_settlement_payer_user_id_idx` ON `transactions`(`household_id`, `settlement_payer_user_id`);

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_settlement_payer_user_id_fkey` FOREIGN KEY (`settlement_payer_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
