'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * WebSocket base URL — strips /api/v1 suffix because Socket.IO attaches
 * to the same host root (/ws namespace).
 */
const WS_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

export interface BidEvent {
  auctionId: string;
  bidId: string;
  amount: number;
  bidderId: string;
  version: number;
  endsAt: number;
  extended: boolean;
  at: number;
}

export interface AuctionEndedEvent {
  auctionId: string;
  winnerId: string | null;
  finalPrice: number;
  at: number;
}

export interface UseAuctionSocketReturn {
  connected: boolean;
  latestBid: BidEvent | null;
  ended: AuctionEndedEvent | null;
  endsAt: number | null; // ms epoch — updates on anti-snipe extend
}

/**
 * useAuctionSocket — subscribes to a single auction's real-time feed.
 *
 *   - Opens a Socket.IO connection to /ws (credentials:true so the auth
 *     cookie is sent)
 *   - Joins room `auction:<id>` and listens for bid:placed + auction:ended
 *   - On re-mount, cleanly disconnects prior socket
 *   - Auto-reconnects with exponential backoff (handled by Socket.IO)
 */
export function useAuctionSocket(
  auctionId: string | null,
): UseAuctionSocketReturn {
  const [connected, setConnected] = useState(false);
  const [latestBid, setLatestBid] = useState<BidEvent | null>(null);
  const [ended, setEnded] = useState<AuctionEndedEvent | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!auctionId) return;

    const socket = io(`${WS_BASE}/ws`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('auction:join', { auctionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('bid:placed', (evt: BidEvent) => {
      setLatestBid(evt);
      setEndsAt(evt.endsAt);
    });
    socket.on('auction:ended', (evt: AuctionEndedEvent) => {
      setEnded(evt);
    });

    return () => {
      socket.emit('auction:leave', { auctionId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auctionId]);

  return { connected, latestBid, ended, endsAt };
}
