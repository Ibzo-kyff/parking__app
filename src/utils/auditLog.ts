import prisma from './prisma';
import { Prisma } from '@prisma/client';

interface AuditLogData {
  userId?: number;
  userName?: string;
  action: string;
  entity: string;
  entityId?: number;
  details?: any;
  ip?: string;
  userAgent?: string;
}

export const createAuditLog = async (data: AuditLogData) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details ?? Prisma.JsonNull,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la création du log d'audit:", error);
  }
};