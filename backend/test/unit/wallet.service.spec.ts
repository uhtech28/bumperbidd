import { Test } from '@nestjs/testing';
import { WalletService } from '../../src/modules/wallet/services/wallet.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

// Mock Prisma — each test sets up the minimum surface it needs
const mockPrisma = () => {
  const state: any = { wallets: new Map(), entries: [], holds: [] };
  return {
    __state: state,
    wallet: {
      findUnique: jest.fn(({ where }) => state.wallets.get(where.userId) ?? null),
      create: jest.fn(({ data }) => {
        const w = { id: `w-${data.userId}`, balance: 0, heldBalance: 0, ...data };
        state.wallets.set(data.userId, w);
        return w;
      }),
      update: jest.fn(({ where, data }) => {
        const w = state.wallets.get(where.userId) ?? [...state.wallets.values()].find((x: any) => x.id === where.id);
        if (!w) throw new Error('wallet not found');
        Object.assign(w, data);
        if (data.balance?.increment) w.balance += data.balance.increment;
        if (data.balance?.decrement) w.balance -= data.balance.decrement;
        if (data.heldBalance?.increment) w.heldBalance += data.heldBalance.increment;
        if (data.heldBalance?.decrement) w.heldBalance -= data.heldBalance.decrement;
        return w;
      }),
    },
    walletEntry: {
      create: jest.fn(({ data }) => { const e = { id: `e-${state.entries.length}`, ...data }; state.entries.push(e); return e; }),
      findUnique: jest.fn(({ where }) => state.entries.find((e: any) => e.idempotencyKey === where.idempotencyKey) ?? null),
      findMany: jest.fn(() => state.entries),
    },
    walletHold: {
      findFirst: jest.fn(({ where }) => state.holds.find((h: any) => h.walletId === where.walletId && h.auctionId === where.auctionId && h.status === 'active') ?? null),
      findUnique: jest.fn(({ where }) => state.holds.find((h: any) => h.id === where.id) ?? null),
      create: jest.fn(({ data }) => { const h = { id: `h-${state.holds.length}`, status: 'active', ...data }; state.holds.push(h); return h; }),
      update: jest.fn(({ where, data }) => { const h = state.holds.find((x: any) => x.id === where.id); Object.assign(h, data); return h; }),
    },
    $transaction: jest.fn(async (fn: any) => fn(mockPrisma())),
  } as any;
};

describe('WalletService', () => {
  let svc: WalletService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrisma();
    const mod = await Test.createTestingModule({
      providers: [WalletService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(WalletService);
  });

  it('creates wallet on first access', async () => {
    const w = await svc.getOrCreate('u1');
    expect(w.balance).toBe(0);
  });

  it('credit is idempotent on same key', async () => {
    await svc.getOrCreate('u1');
    const r1 = await svc.credit({ userId: 'u1', amount: 100000, idempotencyKey: 'k1' });
    const r2 = await svc.credit({ userId: 'u1', amount: 100000, idempotencyKey: 'k1' });
    expect((r2 as any).alreadyApplied).toBe(true);
  });

  it('rejects zero / negative credit', async () => {
    await svc.getOrCreate('u1');
    await expect(svc.credit({ userId: 'u1', amount: 0, idempotencyKey: 'z' })).rejects.toThrow();
    await expect(svc.credit({ userId: 'u1', amount: -10, idempotencyKey: 'n' })).rejects.toThrow();
  });
});
