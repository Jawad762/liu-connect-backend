/*
  Warnings:

  - Changed the type of `reason` on the `CommentReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reason` on the `PostReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'SEXUAL_CONTENT', 'HATE_SPEECH', 'DISCRIMINATION', 'OTHER');

-- AlterTable
ALTER TABLE "CommentReport" DROP COLUMN "reason",
ADD COLUMN     "reason" "ReportReason" NOT NULL;

-- AlterTable
ALTER TABLE "PostReport" DROP COLUMN "reason",
ADD COLUMN     "reason" "ReportReason" NOT NULL;
