-- AlterTable
ALTER TABLE "User" ADD COLUMN     "connectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeen" TIMESTAMP(3),
ADD COLUMN     "socketId" TEXT;
