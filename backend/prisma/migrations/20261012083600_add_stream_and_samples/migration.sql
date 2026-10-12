-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('CREATED', 'PLAYING', 'PAUSED', 'ENDED');

-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StreamStatus" NOT NULL DEFAULT 'CREATED',
    "requireAuth" BOOLEAN NOT NULL DEFAULT false,
    "positionMs" INTEGER NOT NULL DEFAULT 0,
    "stateChangedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSample" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewers" INTEGER NOT NULL,
    "positionMs" INTEGER NOT NULL,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "StreamSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stream_ownerId_createdAt_idx" ON "Stream"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Stream_videoId_idx" ON "Stream"("videoId");

-- CreateIndex
CREATE INDEX "Stream_status_createdAt_idx" ON "Stream"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StreamSample_streamId_ts_idx" ON "StreamSample"("streamId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSample_streamId_ts_key" ON "StreamSample"("streamId", "ts");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSample" ADD CONSTRAINT "StreamSample_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
