-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "nom" TEXT NOT NULL DEFAULT 'Inconnu',
ADD COLUMN     "prenom" TEXT NOT NULL DEFAULT 'Inconnu';
