import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly bidsPlaced = new Counter({ name: 'bumperbid_bids_placed_total', help: 'Total bids accepted', labelNames: ['auction_status'] });
  readonly bidsRejected = new Counter({ name: 'bumperbid_bids_rejected_total', help: 'Total bids rejected', labelNames: ['code'] });
  readonly bidLatency = new Histogram({ name: 'bumperbid_bid_latency_seconds', help: 'End-to-end bid processing time', buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2] });
  readonly wsConnections = new Gauge({ name: 'bumperbid_ws_connections', help: 'Active WebSocket connections' });
  readonly auctionsLive = new Gauge({ name: 'bumperbid_auctions_live', help: 'Currently live auctions' });
  readonly walletHoldsLocked = new Gauge({ name: 'bumperbid_wallet_holds_paisa', help: 'Total paisa locked in active holds' });
  readonly httpRequests = new Counter({ name: 'bumperbid_http_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status'] });
  readonly httpLatency = new Histogram({ name: 'bumperbid_http_latency_seconds', help: 'HTTP request latency', labelNames: ['method', 'route'], buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] });

  onModuleInit() {
    collectDefaultMetrics({ prefix: 'bumperbid_' });
  }

  async snapshot() {
    return register.metrics();
  }

  contentType() {
    return register.contentType;
  }
}
