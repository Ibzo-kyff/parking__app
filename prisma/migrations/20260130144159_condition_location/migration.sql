-- CreateEnum
CREATE TYPE "LocalisationType" AS ENUM ('BAMAKO', 'HORS_BAMAKO');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "conditionsAcceptees" BOOLEAN,
ADD COLUMN     "localisation" "LocalisationType",
ADD COLUMN     "motifLocation" TEXT;
