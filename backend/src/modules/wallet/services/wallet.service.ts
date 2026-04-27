import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { HoldStatus, WalletEntryType } from '@prisma/client';

/**
 * WalletService — double-entry ledger for user balances.
 *
 * Invariants:
 *   - `balance` is available funds (spendable / holdable)
 *   - `heldBalance` is funds reserved for live bids (not spendable)
 *   - every balance change writes an immutable WalletEntry row with
 *     a snapshot of `balanceAfter` for audit
 *   - all multi-row operations run inside a Prisma $transaction
 *   - `idempotencyKey` on WalletEntry ensures retries don't double-credit
 *
 * Holds lifecycle:
 *   active   → reserved when user places a bid
 *   released → user outbid or auction cancelled → funds return to balance
 *   captured → user won → hold converts to debit; balance unchanged,
 *              heldBalance decreases
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    return this.prisma.wallet.create({ data: { userId } });
  }

  async getBalance(userId: string) {
    const w = await this.getOrCreate(userId);
    return {
      balance: w.balance,
      heldBalance: w.heldBalance,
      total: w.balance + w.heldBalance,
    };
  }

  async listEntries(
    userId: string,
    opts: { limit?: number; cursor?: string } = {},
  ) {
    const wallet = await this.getOrCreate(userId);
    const limit = Math.min(opts.limit ?? 30, 100);
    const rows = await this.prisma.walletEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const next = rows.pop()!;
      nextCursor = next.id;
    }
    return { items: rows, nextCursor };
  }

  /**
   * Credit funds (top-up / refund / promo). Idempotent via idempotencyKey.
   */
  async credit(params: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    type?: WalletEntryType;
    note?: string;
    referenceType?: string;
    referenceId?: string;
  }): Promise<any> {
    const { userId, amount, idempotencyKey, note } = params;
    const type = params.type ?? ('credit' as WalletEntryType);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive integer (paisa).',
      });
    }

    const wallet = await this.getOrCreate(userId);

    const existing = await this.prisma.walletEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { alreadyApplied: true, entry: existing };
    }

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      const entry = await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceAfter: updated.balance,
          idempotencyKey,
          note,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });
      return { alreadyApplied: false, entry };
    });
  }

  /**
   * Place (or upgrade) a hold for a bid. If the user already has an
   * active hold on this auction, we upgrade it — only the delta is
   * moved from balance → heldBalance.
   */
  async placeHold(params: {
    userId: string;
    auctionId: string;
    amount: number;
  }): Promise<any> {
    const { userId, auctionId, amount } = params;
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Hold amount must be a positive integer (paisa).',
      });
    }

    const wallet = await this.getOrCreate(userId);

    return this.prisma.$transaction(async (tx: any) => {
      if (!wallet) {
        throw new NotFoundException({ code: 'WALLET_NOT_FOUND' });
      }

      const existing = await tx.walletHold.findFirst({
        where: {
          walletId: wallet.id,
          auctionId,
          status: HoldStatus.active,
        },
      });

      const prevAmount = existing ? existing.amount : 0;
      const delta = amount - prevAmount;

      if (delta > 0) {
        const fresh = await tx.wallet.findUnique({
          where: { id: wallet.id },
        });
        if (!fresh || fresh.balance < delta) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient wallet balance. Need ₹${(delta / 100).toFixed(0)} more.`,
            details: {
              balance: fresh ? fresh.balance : 0,
              required: delta,
            },
          });
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: delta },
            heldBalance: { increment: delta },
          },
        });
      } else if (delta < 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: -delta },
            heldBalance: { decrement: -delta },
          },
        });
      }

      let hold;
      if (existing) {
        hold = await tx.walletHold.update({
          where: { id: existing.id },
          data: { amount },
        });
      } else {
        hold = await tx.walletHold.create({
          data: {
            walletId: wallet.id,
            auctionId,
            amount,
            status: HoldStatus.active,
          },
        });
      }

      const after = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });
      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: 'hold' as WalletEntryType,
          amount: Math.abs(delta),
          balanceAfter: after!.balance,
          referenceType: 'hold',
          referenceId: hold.id,
          note: existing
            ? `Increased hold for auction ${auctionId}`
            : `Placed hold for auction ${auctionId}`,
        },
      });

      return hold;
    });
  }

  /** Release a specific hold back to balance. */
  async releaseHold(holdId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const hold = await tx.walletHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.status !== HoldStatus.active) return null;

      await tx.wallet.update({
        where: { id: hold.walletId },
        data: {
          balance: { increment: hold.amount },
          heldBalance: { decrement: hold.amount },
        },
      });
      const updatedHold = await tx.walletHold.update({
        where: { id: holdId },
        data: { status: HoldStatus.released, resolvedAt: new Date() },
      });
      const after = await tx.wallet.findUnique({
        where: { id: hold.walletId },
      });
      await tx.walletEntry.create({
        data: {
          walletId: hold.walletId,
          type: 'release' as WalletEntryType,
          amount: hold.amount,
          balanceAfter: after!.balance,
          referenceType: 'hold',
          referenceId: holdId,
          note: `Released hold for auction ${hold.auctionId}`,
        },
      });
      return updatedHold;
    });
  }

  /** Lookup active hold for (user, auction) and release it. */
  async releaseActiveHoldForAuction(params: {
    userId: string;
    auctionId: string;
  }) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: params.userId },
    });
    if (!wallet) return null;
    const hold = await this.prisma.walletHold.findFirst({
      where: {
        walletId: wallet.id,
        auctionId: params.auctionId,
        status: HoldStatus.active,
      },
    });
    if (!hold) return null;
    return this.releaseHold(hold.id);
  }

  /**
   * Capture the winning hold — user won the auction. Held funds are
   * permanently debited: balance unchanged, heldBalance decreases.
   */
  async captureHold(params: { userId: string; auctionId: string }) {
    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: params.userId },
      });
      if (!wallet) return null;
      const hold = await tx.walletHold.findFirst({
        where: {
          walletId: wallet.id,
          auctionId: params.auctionId,
          status: HoldStatus.active,
        },
      });
      if (!hold) return null;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { heldBalance: { decrement: hold.amount } },
      });
      const updatedHold = await tx.walletHold.update({
        where: { id: hold.id },
        data: { status: HoldStatus.captured, resolvedAt: new Date() },
      });
      const after = await tx.wallet.findUnique({ where: { id: wallet.id } });
      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: 'debit' as WalletEntryType,
          amount: hold.amount,
          balanceAfter: after!.balance,
          referenceType: 'auction',
          referenceId: hold.auctionId,
          note: `Captured hold — won auction ${hold.auctionId}`,
        },
      });
      return updatedHold;
    });
  }
}
