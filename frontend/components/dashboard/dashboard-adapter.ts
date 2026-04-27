/**
 * Maps backend Auction (from `lib/api.ts`) -> the UI Auction shape the
 * dashboard cards already know how to render. Keeps the card components
 * untouched while the dashboard switches from mock data to real data.
 */
import type { Auction as ApiAuction } from '@/lib/api';
import type {
  Auction as UiAuction,
  AuctionCategory,
} from './mock-data';

const GRADIENTS: Record<AuctionCategory, [string, string]> = {
  premium: ['#27272a', '#09090b'],
  bike: ['#3f2a1d', '#1a0f08'],
  car: ['#1f2937', '#0b1220'],
  budget: ['#1c2b3a', '#0a141f'],
};

// Backend stores all money in PAISA (1 INR = 100 paisa). UI formatters
// expect rupees, so divide at the adapter boundary once.
const paisaToRupees = (n: number | null | undefined): number =>
  Math.round((n ?? 0) / 100);

const PREMIUM_FLOOR = 2_000_000; // Rs 20 L
const BUDGET_CEILING = 700_000; // Rs 7 L

export function categoryForAuction(a: ApiAuction): AuctionCategory {
  const make = a.vehicle.make.toLowerCase();
  if (
    /royal enfield|ktm|bajaj|honda cbr|yamaha|tvs|hero|kawasaki|ducati|harley/.test(
      make,
    )
  ) {
    return 'bike';
  }
  const priceRupees = paisaToRupees(
    a.live.currentHighBid ?? a.pricing.startingPrice,
  );
  if (priceRupees >= PREMIUM_FLOOR) return 'premium';
  if (priceRupees <= BUDGET_CEILING) return 'budget';
  return 'car';
}

export function gradientFor(cat: AuctionCategory): [string, string] {
  return GRADIENTS[cat];
}

function tagFor(a: ApiAuction, allEndsAt: number[]): UiAuction['tag'] {
  const endsAt = new Date(a.endsAt).getTime();
  const msLeft = endsAt - Date.now();
  if (a.status === 'live' && msLeft > 0 && msLeft < 15 * 60_000) {
    return 'Ending soon';
  }
  const createdAt = new Date(a.createdAt).getTime();
  if (Date.now() - createdAt < 6 * 60 * 60_000) return 'New';
  if (a.live.bidCount >= 30) return 'Hot';
  if (allEndsAt.length > 3) {
    const sorted = [...allEndsAt].sort((x, y) => y - x);
    const topThird = sorted[Math.floor(sorted.length / 3)];
    if (endsAt >= topThird) return 'Featured';
  }
  return undefined;
}

export function toUiAuction(
  a: ApiAuction,
  allEndsAt: number[] = [],
): UiAuction {
  const category = categoryForAuction(a);
  const currentBidRupees = paisaToRupees(
    a.live.currentHighBid ?? a.pricing.startingPrice,
  );
  const startingBidRupees = paisaToRupees(a.pricing.startingPrice);
  const subtitle = [
    `${a.vehicle.year}`,
    `${a.vehicle.kmDriven.toLocaleString('en-IN')} km`,
    a.vehicle.city,
  ].join(' \u00b7 ');

  const uiStatus: UiAuction['status'] =
    a.status === 'scheduled'
      ? 'upcoming'
      : a.status === 'ended' || a.status === 'cancelled'
        ? 'ended'
        : 'live';

  return {
    id: a.id,
    title: a.title,
    subtitle,
    category,
    currentBid: currentBidRupees,
    startingBid: startingBidRupees,
    bidders: a.live.bidCount,
    endsAt: new Date(a.endsAt).getTime(),
    status: uiStatus,
    gradient: gradientFor(category),
    tag: tagFor(a, allEndsAt),
    imageUrls: a.vehicle.imageUrls ?? [],
  };
}

export function toUiAuctions(list: ApiAuction[]): UiAuction[] {
  const allEnds = list.map((a) => new Date(a.endsAt).getTime());
  return list.map((a) => toUiAuction(a, allEnds));
}

export function computeCategoryCounts(
  list: ApiAuction[],
): Record<AuctionCategory | 'all', number> {
  const base = { all: list.length, car: 0, bike: 0, premium: 0, budget: 0 };
  for (const a of list) {
    const c = categoryForAuction(a);
    base[c] += 1;
  }
  return base;
}
