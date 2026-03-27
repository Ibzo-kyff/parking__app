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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("@prisma/client");
const createAuditLog = (data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        yield prisma_1.default.auditLog.create({
            data: {
                userId: data.userId,
                userName: data.userName,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                details: (_a = data.details) !== null && _a !== void 0 ? _a : client_1.Prisma.JsonNull,
                ip: data.ip,
                userAgent: data.userAgent,
            },
        });
    }
    catch (error) {
        console.error("Erreur lors de la création du log d'audit:", error);
    }
});
exports.createAuditLog = createAuditLog;
