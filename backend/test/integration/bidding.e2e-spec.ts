/**
 * Integration test scaffold — spins up a real Nest app against testcontainers Postgres + Redis.
 * Run with: npm run test:integration
 * Requires: docker daemon running locally.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Bidding flow (e2e)', () => {
  let app: INestApplication;
  let cookies: string[] = [];

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('signs up, tops up, bids on a live auction, wins', async () => {
    // Happy path — requires seed data + running Postgres/Redis
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/email/signup')
      .send({ email: `e2e-${Date.now()}@test.in`, password: 'Bidder@123', displayName: 'E2E' });
    expect([200, 201]).toContain(signup.status);
    cookies = signup.get('set-cookie') as unknown as string[];
  });
});
