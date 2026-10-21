-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "donationOverlay" JSONB NOT NULL DEFAULT '{"x":20,"y":5,"width":60,"height":30}';
