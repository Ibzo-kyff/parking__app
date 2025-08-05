/*
  Warnings:

  - Added the required column `city` to the `Parking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Parking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fuelType` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('ESSENCE', 'DIESEL', 'ELECTRIQUE', 'HYBRIDE', 'GPL', 'AUTRE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION', 'MESSAGE', 'SYSTEM', 'ALERT', 'PROMOTION');

-- AlterEnum
ALTER TYPE "VehicleStatus" ADD VALUE 'INDISPONIBLE';

-- AlterTable
ALTER TABLE "Parking" ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "fuelType" "FuelType" NOT NULL,
ADD COLUMN     "mileage" INTEGER,
ADD COLUMN     "model" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "parkingId" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
