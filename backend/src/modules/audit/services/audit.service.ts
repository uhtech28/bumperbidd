import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    diff?: any;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        diff: entry.diff ?? null,
        ip: entry.ip,
        userAgent: entry.userAgent,
      },
    });
  }

  async list(opts: { limit?: number; cursor?: string; adminId?: string; action?: string; targetType?: string; targetId?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const where: any = {};
    if (opts.adminId) where.adminId = opts.adminId;
    if (opts.action) where.action = opts.action;
    if (opts.targetType) where.targetType = opts.targetType;
    if (opts.targetId) where.targetId = opts.targetId;
    const rows = await this.prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }
}
