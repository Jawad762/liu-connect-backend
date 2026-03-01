-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "followers_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "following_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "major" TEXT,
ADD COLUMN     "school" TEXT;
