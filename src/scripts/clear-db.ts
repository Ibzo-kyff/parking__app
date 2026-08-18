import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.vehicleStats.deleteMany();
  await prisma.vehicleHistory.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.parking.deleteMany();

  // Garde les marques si tu veux
  // await prisma.marque.deleteMany();

  // Garde l'admin
  await prisma.user.deleteMany({
    where: {
      role: {
        not: "ADMIN",
      },
    },
  });

  console.log("✅ Base nettoyée.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });