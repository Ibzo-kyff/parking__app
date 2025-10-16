import { PrismaClient, Role, Status, ParkingStatus, VehicleStatus, FuelType, ReservationType, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding (version Mali)...');

  // Nettoyage des anciennes données
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.message.deleteMany();
  await prisma.vehicleHistory.deleteMany();
  await prisma.vehicleStats.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.parking.deleteMany();
  await prisma.user.deleteMany();
  await prisma.marque.deleteMany();

  // Hash des mots de passe
  const hashedDefault = await bcrypt.hash('20210011', 10);
  const hashedAdmin = await bcrypt.hash('20210012', 10);

  console.log('🔐 Mots de passe hachés appliqués');

  // === 1. Marques ===
  console.log('🚗 Création des marques...');
  const marques = await prisma.marque.createManyAndReturn({
    data: [
      { name: 'Toyota', logoUrl: 'https://example.com/toyota.png' },
      { name: 'Hyundai', logoUrl: 'https://example.com/hyundai.png' },
      { name: 'Peugeot', logoUrl: 'https://example.com/peugeot.png' },
      { name: 'Mercedes', logoUrl: 'https://example.com/mercedes.png' },
      { name: 'BMW', logoUrl: 'https://example.com/bmw.png' },
    ]
  });

  // === 2. Utilisateurs ===
  console.log('👥 Création des utilisateurs...');

  const client1 = await prisma.user.create({
    data: {
      email: 'moribatraore740@gmail.com',
      phone: '+22370123456',
      role: Role.CLIENT,
      nom: 'Traoré',
      prenom: 'Moriba',
      password: hashedDefault,
      emailVerified: true,
      address: 'Sebenicoro, Bamako',
      image: 'https://example.com/avatar-moriba.jpg'
    }
  });

  const client2 = await prisma.user.create({
    data: {
      email: 'aissata.traore@example.com',
      phone: '+22375123456',
      role: Role.CLIENT,
      nom: 'Traoré',
      prenom: 'Aïssata',
      password: hashedDefault,
      emailVerified: true,
      address: 'Missira, Bamako',
      image: 'https://example.com/avatar-aissata.jpg'
    }
  });

  const parkingManager1 = await prisma.user.create({
    data: {
      email: 'kouyatemoussa003@gmail.com',
      phone: '+22360123456',
      role: Role.PARKING,
      nom: 'Keita',
      prenom: 'Ibrahim',
      password: hashedDefault,
      emailVerified: true,
      status: Status.APPROVED,
      address: 'Kalaban Coura, Bamako',
      image: 'https://example.com/avatar-ibrahim.jpg'
    }
  });

  const parkingManager2 = await prisma.user.create({
    data: {
      email: 'issa.diarra@parkingml.com',
      phone: '+22365123456',
      role: Role.PARKING,
      nom: 'Diarra',
      prenom: 'Issa',
      password: hashedDefault,
      emailVerified: true,
      status: Status.APPROVED,
      address: 'Sirakoro, Bamako',
      image: 'https://example.com/avatar-issa.jpg'
    }
  });

  const admin = await prisma.user.create({
    data: {
      email: 'ikadev2022@gmail.com',
      phone: '+22350000000',
      role: Role.ADMIN,
      nom: 'Diabaté',
      prenom: 'Admin',
      password: hashedAdmin,
      emailVerified: true,
      status: Status.APPROVED,
      address: 'Bamako-Coura, Bamako'
    }
  });

  // === 3. Parkings ===
  console.log('🅿️ Création des parkings...');
  const parking1 = await prisma.parking.create({
    data: {
      userId: parkingManager1.id,
      name: 'Safty Auto Parking',
      address: 'Rue 224, ACI 2000, Bamako',
      phone: '+22370707070',
      description: 'Parking moderne et sécurisé 24h/24 au centre de Bamako',
      capacity: 60,
      hoursOfOperation: '06:00 - 22:00',
      status: ParkingStatus.ACTIVE,
      logo: 'https://example.com/parking-aci.jpg',
      city: 'Bamako',
      email: 'contact@parkingaci.ml'
    }
  });

  const parking2 = await prisma.parking.create({
    data: {
      userId: parkingManager2.id,
      name: 'Dana Auto Parking',
      address: 'Kalaban Coura Rue 15, Bamako',
      phone: '+22365656565',
      description: 'Parking spacieux proche du marché de Kalaban',
      capacity: 80,
      hoursOfOperation: '05:00 - 00:00',
      status: ParkingStatus.ACTIVE,
      logo: 'https://example.com/parking-kalaban.jpg',
      city: 'Bamako',
      email: 'info@parkingkalaban.ml'
    }
  });

  // === 4. Véhicules ===
  console.log('🚙 Création des véhicules...');
  const vehiclesData = [
    {
      parkingId: parking1.id,
      marqueId: marques[0].id,
      model: 'Corolla',
      year: 2022,
      prix: 8500000,
      description: 'Toyota Corolla récente, très bon état',
      photos: ['https://example.com/corolla1.jpg'],
      garantie: true,
      dureeGarantie: 24,
      chauffeur: false,
      assurance: true,
      dureeAssurance: 12,
      carteGrise: true,
      vignette: true,
      forSale: true,
      forRent: false,
      status: VehicleStatus.DISPONIBLE,
      fuelType: FuelType.ESSENCE,
      mileage: 15000
    },
    {
      parkingId: parking1.id,
      marqueId: marques[2].id,
      model: '208',
      year: 2023,
      prix: 9500000,
      description: 'Peugeot 208 neuve avec climatisation',
      photos: ['https://example.com/208-ml.jpg'],
      garantie: true,
      dureeGarantie: 36,
      chauffeur: true,
      assurance: true,
      carteGrise: true,
      vignette: true,
      forSale: false,
      forRent: true,
      status: VehicleStatus.DISPONIBLE,
      fuelType: FuelType.DIESEL,
      mileage: 5000
    },
    {
      parkingId: parking2.id,
      marqueId: marques[1].id,
      model: 'Accent',
      year: 2021,
      prix: 7800000,
      description: 'Hyundai Accent confortable, faible consommation',
      photos: ['https://example.com/accent-ml.jpg'],
      garantie: true,
      dureeGarantie: 12,
      chauffeur: false,
      assurance: true,
      carteGrise: true,
      vignette: true,
      forSale: true,
      forRent: true,
      status: VehicleStatus.DISPONIBLE,
      fuelType: FuelType.ESSENCE,
      mileage: 23000
    },
    {
      userOwnerId: client1.id,
      marqueId: marques[4].id,
      model: 'X1',
      year: 2021,
      prix: 13500000,
      description: 'BMW X1 bien entretenue, vendue par particulier',
      photos: ['https://example.com/bmwx1-ml.jpg'],
      garantie: false,
      chauffeur: false,
      assurance: true,
      carteGrise: true,
      vignette: true,
      forSale: true,
      forRent: false,
      status: VehicleStatus.DISPONIBLE,
      fuelType: FuelType.DIESEL,
      mileage: 22000
    }
  ];

  const vehicles = await Promise.all(vehiclesData.map(v => prisma.vehicle.create({ data: v })));

  // === 5. Statistiques / Messages / Réservations / Notifications (abrégés) ===
  console.log('📊 Ajout des statistiques et notifications...');
  await Promise.all(vehicles.map(v => prisma.vehicleStats.create({
    data: { vehicleId: v.id, vues: Math.floor(Math.random() * 100), reservations: Math.floor(Math.random() * 10) }
  })));

  await prisma.notification.createMany({
    data: [
      {
        userId: client1.id,
        title: 'Réservation confirmée',
        message: 'Votre réservation pour la Toyota Corolla est confirmée.',
        type: NotificationType.RESERVATION
      },
      {
        userId: client2.id,
        title: 'Nouvelle promotion',
        message: 'Profitez de 10% de réduction ce week-end sur toutes les locations.',
        type: NotificationType.PROMOTION
      }
    ]
  });

  console.log('✅ Seeding terminé avec succès !');
}

main()
  .catch(e => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
