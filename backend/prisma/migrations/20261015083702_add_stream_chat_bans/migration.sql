-- CreateTable
CREATE TABLE "StreamChatBan" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "streamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,

    CONSTRAINT "StreamChatBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamChatBan_streamId_expiresAt_idx" ON "StreamChatBan"("streamId", "expiresAt");

-- CreateIndex
CREATE INDEX "StreamChatBan_userId_idx" ON "StreamChatBan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamChatBan_streamId_userId_key" ON "StreamChatBan"("streamId", "userId");

-- AddForeignKey
ALTER TABLE "StreamChatBan" ADD CONSTRAINT "StreamChatBan_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamChatBan" ADD CONSTRAINT "StreamChatBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamChatBan" ADD CONSTRAINT "StreamChatBan_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
