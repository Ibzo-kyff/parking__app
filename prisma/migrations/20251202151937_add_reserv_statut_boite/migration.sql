-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "transmission" "Transmission" NOT NULL DEFAULT 'MANUAL';
