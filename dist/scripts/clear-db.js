"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.auditLog.deleteMany();
        yield prisma.favorite.deleteMany();
        yield prisma.notification.deleteMany();
        yield prisma.message.deleteMany();
        yield prisma.reservation.deleteMany();
        yield prisma.vehicleStats.deleteMany();
        yield prisma.vehicleHistory.deleteMany();
        yield prisma.vehicle.deleteMany();
        yield prisma.parking.deleteMany();
        // Garde les marques si tu veux
        // await prisma.marque.deleteMany();
        // Garde l'admin
        yield prisma.user.deleteMany({
            where: {
                role: {
                    not: "ADMIN",
                },
            },
        });
        console.log("✅ Base nettoyée.");
    });
}
main()
    .catch(console.error)
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
