/*
  Warnings:

  - The values [COMMUNITY] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `type` to the `CommentMedia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `PostMedia` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaTypeEnum" AS ENUM ('IMAGE', 'VIDEO');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('LIKE', 'COMMENT', 'FOLLOW', 'MENTION');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterTable
ALTER TABLE "CommentMedia" ADD COLUMN     "type" "MediaTypeEnum" NOT NULL;

-- AlterTable
ALTER TABLE "PostMedia" ADD COLUMN     "type" "MediaTypeEnum" NOT NULL;
