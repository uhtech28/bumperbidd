/**
 * Demo data for the dashboard. In production this is replaced by server
 * fetches — the shapes here are the contract the UI expects from the
 * auction service. Timers use epoch ms so countdown components can
 * compute remaining time in a single pass without per-render parsing.
 */

export type AuctionCategory = 'car' | 'bike' | 'premium' | 'budget';
export type AuctionStatus = 'live' | 'upcoming' | 'ended';

export interface Auction {
  id: string;
  title: string;
  subtitle: string;
  category: AuctionCategory;
  currentBid: number;
  startingBid: number;
  bidders: number;
  endsAt: number;
  status: AuctionStatus;
  gradient: [string, string];
  tag?: 'Featured' | 'Hot' | 'Ending soon' | 'New';
}

export interface RecentBid {
  id: string;
  auctionTitle: string;
  amount: number;
  placedAtMinutesAgo: number;
  state: 'winning' | 'outbid' | 'won';
}

export interface ActivitySnapshot {
  auctionsJoined: number;
  bidsPlaced: number;
  winning: number;
  wonLifetimeValue: number;
  recent: RecentBid[];
}

// `now` captured once at module load so timers are deterministic relative
// to each other during a session. Production data will come from server.
const now = Date.now();
const min = 60_000;

export const LIVE_AUCTIONS: Auction[] = [
  {
    id: 'a-01',
    title: 'Hyundai Creta SX',
    subtitle: '2022 · 28,450 km · Delhi',
    category: 'car',
    currentBid: 1_285_000,
    startingBid: 950_000,
    bidders: 42,
    endsAt: now + 14 * min + 22_000,
    status: 'live',
    gradient: ['#1f2937', '#0b1220'],
    tag: 'Hot',
  },
  {
    id: 'a-02',
    title: 'BMW 3 Series 330i',
    subtitle: '2021 · 19,100 km · Mumbai',
    category: 'premium',
    currentBid: 3_640_000,
    startingBid: 2_800_000,
    bidders: 67,
    endsAt: now + 47 * min + 8_000,
    status: 'live',
    gradient: ['#1e293b', '#030712'],
    tag: 'Featured',
  },
  {
    id: 'a-03',
    title: 'Royal Enfield Classic',
    subtitle: '2023 · 4,800 km · Pune',
    category: 'bike',
    currentBid: 185_000,
    startingBid: 145_000,
    bidders: 24,
    endsAt: now + 4 * min + 12_000,
    status: 'live',
    gradient: ['#3f2a1d', '#1a0f08'],
    tag: 'Ending soon',
  },
  {
    id: 'a-04',
    title: 'Mahindra Thar LX',
    subtitle: '2022 · 32,900 km · Jaipur',
    category: 'car',
    currentBid: 1_520_000,
    startingBid: 1_200_000,
    bidders: 38,
    endsAt: now + 92 * min,
    status: 'live',
    gradient: ['#1a2b1f', '#0a140e'],
  },
];

export const FEATURED_AUCTIONS: Auction[] = [
  {
    id: 'f-01',
    title: 'Audi Q5 Premium+',
    subtitle: '2020 · 41,200 km · Bangalore',
    category: 'premium',
    currentBid: 3_180_000,
    startingBid: 2_500_000,
    bidders: 54,
    endsAt: now + 3 * 60 * min,
    status: 'live',
    gradient: ['#27272a', '#09090b'],
    tag: 'Featured',
  },
  {
    id: 'f-02',
    title: 'Maruti Swift VXI',
    subtitle: '2021 · 22,000 km · Hyderabad',
    category: 'budget',
    currentBid: 585_000,
    startingBid: 450_000,
    bidders: 31,
    endsAt: now + 2 * 60 * min + 15 * min,
    status: 'live',
    gradient: ['#1c2b3a', '#0a141f'],
    tag: 'New',
  },
  {
    id: 'f-03',
    title: 'KTM Duke 390',
    subtitle: '2023 · 6,200 km · Kolkata',
    category: 'bike',
    currentBid: 245_000,
    startingBid: 195_000,
    bidders: 19,
    endsAt: now + 80 * min,
    status: 'live',
    gradient: ['#3a1a1a', '#1a0808'],
    tag: 'Hot',
  },
  {
    id: 'f-04',
    title: 'Tata Nexon XZ+',
    subtitle: '2022 · 18,400 km · Chennai',
    category: 'car',
    currentBid: 1_040_000,
    startingBid: 820_000,
    bidders: 26,
    endsAt: now + 6 * 60 * min,
    status: 'live',
    gradient: ['#1f2a1f', '#0a140a'],
  },
];

export const CATEGORIES: { id: string; label: string; count?: number }[] = [
  { id: 'all', label: 'All', count: 142 },
  { id: 'car', label: 'Cars', count: 86 },
  { id: 'bike', label: 'Bikes', count: 34 },
  { id: 'premium', label: 'Premium', count: 18 },
  { id: 'budget', label: 'Budget Deals', count: 24 },
];

export const MY_ACTIVITY: ActivitySnapshot = {
  auctionsJoined: 12,
  bidsPlaced: 47,
  winning: 3,
  wonLifetimeValue: 2_850_000,
  recent: [
    {
      id: 'r-01',
      auctionTitle: 'Hyundai Creta SX',
      amount: 1_285_000,
      placedAtMinutesAgo: 2,
      state: 'winning',
    },
    {
      id: 'r-02',
      auctionTitle: 'BMW 3 Series 330i',
      amount: 3_590_000,
      placedAtMinutesAgo: 11,
      state: 'outbid',
    },
    {
      id: 'r-03',
      auctionTitle: 'Maruti Swift VXI',
      amount: 585_000,
      placedAtMinutesAgo: 42,
      state: 'winning',
    },
  ],
};
