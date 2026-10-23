-- CreateTable
CREATE TABLE "VideoView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "videoId" TEXT NOT NULL,
    "streamId" TEXT,

    CONSTRAINT "VideoView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoView_sessionId_key" ON "VideoView"("sessionId");

-- CreateIndex
CREATE INDEX "VideoView_videoId_viewedAt_idx" ON "VideoView"("videoId", "viewedAt");

-- CreateIndex
CREATE INDEX "VideoView_viewedAt_idx" ON "VideoView"("viewedAt");

-- AddForeignKey
ALTER TABLE "VideoView" ADD CONSTRAINT "VideoView_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoView" ADD CONSTRAINT "VideoView_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
