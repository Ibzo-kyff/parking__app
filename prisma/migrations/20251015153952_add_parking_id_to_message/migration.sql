-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "parkingId" INTEGER;

-- CreateIndex
CREATE INDEX "Marque_name_idx" ON "Marque"("name");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
