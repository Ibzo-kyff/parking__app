/*
  Warnings:

  - The values [EN_LOCATION,ACHETE] on the enum `VehicleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `marque` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `marqueId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VehicleStatus_new" AS ENUM ('DISPONIBLE', 'EN_MAINTENANCE', 'INDISPONIBLE');
ALTER TABLE "Vehicle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Vehicle" ALTER COLUMN "status" TYPE "VehicleStatus_new" USING ("status"::text::"VehicleStatus_new");
ALTER TYPE "VehicleStatus" RENAME TO "VehicleStatus_old";
ALTER TYPE "VehicleStatus_new" RENAME TO "VehicleStatus";
DROP TYPE "VehicleStatus_old";
ALTER TABLE "Vehicle" ALTER COLUMN "status" SET DEFAULT 'DISPONIBLE';
COMMIT;

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "dateDebut" DROP NOT NULL,
ALTER COLUMN "dateFin" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nom" DROP DEFAULT,
ALTER COLUMN "prenom" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "marque",
ADD COLUMN     "forRent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "forSale" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "marqueId" INTEGER NOT NULL,
ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "Marque" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marque_name_key" ON "Marque"("name");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_marqueId_fkey" FOREIGN KEY ("marqueId") REFERENCES "Marque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
