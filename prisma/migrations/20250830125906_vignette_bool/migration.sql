/*
  Warnings:

  - The `assurance` column on the `Vehicle` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `carteGrise` column on the `Vehicle` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `vignette` column on the `Vehicle` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "garantie" SET DEFAULT false,
ALTER COLUMN "chauffeur" SET DEFAULT false,
DROP COLUMN "assurance",
ADD COLUMN     "assurance" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "carteGrise",
ADD COLUMN     "carteGrise" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "vignette",
ADD COLUMN     "vignette" BOOLEAN NOT NULL DEFAULT false;
