-- CreateEnum
CREATE TYPE "BookmarkableType" AS ENUM ('POST', 'COMMENT');

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "type" "BookmarkableType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_type_entity_id_idx" ON "Bookmark"("type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_type_entity_id_key" ON "Bookmark"("userId", "type", "entity_id");

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing post bookmarks
INSERT INTO "Bookmark" ("id", "type", "entity_id", "userId", "created_at", "updated_at")
SELECT "id", 'POST'::"BookmarkableType", "postId", "userId", "created_at", "updated_at"
FROM "PostBookmark";

-- DropForeignKey
ALTER TABLE "PostBookmark" DROP CONSTRAINT "PostBookmark_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostBookmark" DROP CONSTRAINT "PostBookmark_userId_fkey";

-- DropTable
DROP TABLE "PostBookmark";
