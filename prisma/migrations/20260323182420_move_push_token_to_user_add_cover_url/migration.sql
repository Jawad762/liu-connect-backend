/*
  Warnings:

  - You are about to drop the `PushToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PushToken" DROP CONSTRAINT "PushToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cover_url" TEXT,
ADD COLUMN     "push_token" TEXT;

-- DropTable
DROP TABLE "PushToken";
