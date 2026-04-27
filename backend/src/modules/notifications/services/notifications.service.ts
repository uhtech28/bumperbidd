import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  type:
    | NotificationType
    | 'outbid'
    | 'auction_ending_soon'
    | 'auction_won'
    | 'auction_lost'
    | 'auction_cancelled'
    | 'wallet_credited'
    | 'wallet_debited';
  title: string;
  body: string;
  auctionId?: string;
  meta?: Prisma.InputJsonValue;
}

/**
 * NotificationsService — durable, read/unread-tracked notifications.
 *
 * `readAt` is the single source of truth — NULL means unread, any
 * timestamp means read. The RealtimeGateway pushes the same payload
 * over the user's socket room for instant UI updates; the DB row is
 * the fallback for offline users.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<{ id: string }> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type as NotificationType,
        title: input.title,
        body: input.body,
        auctionId: input.auctionId,
        meta: input.meta,
      },
      select: { id: true },
    });
    return row;
  }

  async list(
    userId: string,
    opts: { limit?: number; cursor?: string; unreadOnly?: boolean } = {},
  ) {
    const limit = Math.min(opts.limit ?? 30, 100);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        auctionId: true,
        readAt: true,
        createdAt: true,
      },
    });
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const next = rows.pop()!;
      nextCursor = next.id;
    }
    return {
      items: rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        auctionId: r.auctionId,
        isRead: r.readAt !== null,
        readAt: r.readAt,
        createdAt: r.createdAt,
      })),
      nextCursor,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    // Guard against cross-user mutation — updateMany scope limits.
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: res.count };
  }
}
