-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Community_is_deleted_idx" ON "Community"("is_deleted");
