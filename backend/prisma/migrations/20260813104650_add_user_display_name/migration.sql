/*
  Warnings:

  - Added the required column `display_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `household_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(50) NOT NULL,
    ADD COLUMN `household_id` BIGINT NOT NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
