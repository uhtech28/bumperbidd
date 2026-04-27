import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AppConfig } from '../../config/app.config';

/**
 * RealtimeGateway — the single Socket.IO endpoint for the client.
 *
 * Connection model:
 *   1) Client opens /ws with cookie `bb_access` (HttpOnly JWT) OR
 *      `?token=` query (for environments where cookies aren't forwarded).
 *   2) On connect we verify the JWT and attach the userId to socket.data.
 *      Unauthenticated sockets are disconnected.
 *   3) Client emits `auction:join` { auctionId } to subscribe; server
 *      puts the socket in room `auction:<id>` and immediately pushes
 *      a snapshot on demand (snapshot is fetched via REST before join).
 *
 * Emission model:
 *   - BiddingService.broadcastBid(...) → `bid:placed` in the room.
 *   - BiddingService.broadcastAuctionEnded(...) → `auction:ended`.
 *   - All emissions go through the Redis adapter (see adapters/
 *     redis-io.adapter.ts) so they fan out across backend pods.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(): void {
    this.log.log('Realtime gateway ready (namespace=/ws)');
  }

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { code: 'AUTH_REQUIRED' });
        client.disconnect(true);
        return;
      }
      const { secret } = this.config.get<AppConfig['jwt']>('jwt')!;
      const payload = this.jwt.verify(token, { secret }) as {
        sub?: string;
        type?: string;
      };
      if (payload?.type !== 'access' || !payload.sub) {
        client.emit('error', { code: 'AUTH_INVALID' });
        client.disconnect(true);
        return;
      }
      client.data.userId = payload.sub;
      this.log.debug(`ws connected user=${payload.sub} sid=${client.id}`);
    } catch (err) {
      this.log.warn(`ws auth failed: ${(err as Error).message}`);
      client.emit('error', { code: 'AUTH_INVALID' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.log.debug(
      `ws disconnected user=${client.data?.userId ?? 'anon'} sid=${client.id}`,
    );
  }

  @SubscribeMessage('auction:join')
  onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { auctionId?: string },
  ): { ok: boolean; room?: string; error?: string } {
    const id = body?.auctionId;
    if (!id || typeof id !== 'string') {
      return { ok: false, error: 'INVALID_AUCTION_ID' };
    }
    const room = this.roomFor(id);
    client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('auction:leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { auctionId?: string },
  ): { ok: boolean } {
    const id = body?.auctionId;
    if (!id) return { ok: false };
    client.leave(this.roomFor(id));
    return { ok: true };
  }

  @SubscribeMessage('ping')
  onPing(): { ok: true; at: number } {
    return { ok: true, at: Date.now() };
  }

  // ===== Broadcast API — called by services =====

  broadcastBid(payload: {
    auctionId: string;
    bidId: string;
    userId: string;
    amount: number;
    version: number;
    endsAt: number;
    extended: boolean;
  }): void {
    this.server.to(this.roomFor(payload.auctionId)).emit('bid:placed', {
      auctionId: payload.auctionId,
      bidId: payload.bidId,
      amount: payload.amount,
      bidderId: payload.userId,
      version: payload.version,
      endsAt: payload.endsAt,
      extended: payload.extended,
      at: Date.now(),
    });
  }

  broadcastAuctionEnded(payload: {
    auctionId: string;
    winnerId: string | null;
    finalPrice: number;
  }): void {
    this.server.to(this.roomFor(payload.auctionId)).emit('auction:ended', {
      auctionId: payload.auctionId,
      winnerId: payload.winnerId,
      finalPrice: payload.finalPrice,
      at: Date.now(),
    });
  }

  broadcastAuctionStarted(payload: {
    auctionId: string;
    endsAt: number;
    startingPrice: number;
  }): void {
    this.server.to(this.roomFor(payload.auctionId)).emit('auction:started', {
      auctionId: payload.auctionId,
      endsAt: payload.endsAt,
      startingPrice: payload.startingPrice,
      at: Date.now(),
    });
  }

  /** Emit a private notification to a single user across all their sockets. */
  sendToUser(userId: string, event: string, payload: unknown): void {
    // We don't track per-user rooms here (requires extra bookkeeping).
    // Instead we broadcast to a deterministic user room each socket joins
    // on connect. To keep this lightweight we use the Socket.IO
    // `sockets.adapter` iteration.
    this.server
      .to(this.userRoomFor(userId))
      .emit(event, { ...(payload as object), at: Date.now() });
  }

  private roomFor(auctionId: string): string {
    return `auction:${auctionId}`;
  }

  private userRoomFor(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const parts = cookieHeader.split(';').map((p) => p.trim());
      for (const p of parts) {
        if (p.startsWith('bb_access=')) {
          return decodeURIComponent(p.slice('bb_access='.length));
        }
      }
    }
    const auth = client.handshake.auth?.token;
    if (auth && typeof auth === 'string') return auth;
    const qs = client.handshake.query?.token;
    if (qs && typeof qs === 'string') return qs;
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }
    return null;
  }
}
