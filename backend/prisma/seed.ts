/* eslint-disable no-console */
import { PrismaClient, AuctionStatus, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed data for BumperBid. Creates:
 *  - 10 users (1 admin + 9 regular), each with ₹5,00,000 in their wallet
 *  - 5 live auctions (ending 5..30 minutes from now)
 *  - 3 scheduled auctions (starting 10..60 minutes from now)
 *  - 2 ended auctions (with winners) to populate the "past auctions" UI
 *
 * Run with: npm run prisma:seed
 * Uses upsert semantics so it's safe to run multiple times — the dataset
 * re-creates the same rows, never duplicates them.
 */

const TEST_PASSWORD = 'bumperbid123';
const USERS = [
  { email: 'admin@bumperbid.test', name: 'BumperBid Admin', phone: '+919000000001' },
  { email: 'rohit@bumperbid.test', name: 'Rohit Sharma',   phone: '+919000000002' },
  { email: 'priya@bumperbid.test', name: 'Priya Menon',    phone: '+919000000003' },
  { email: 'arjun@bumperbid.test', name: 'Arjun Kapoor',   phone: '+919000000004' },
  { email: 'neha@bumperbid.test',  name: 'Neha Iyer',      phone: '+919000000005' },
  { email: 'vikram@bumperbid.test',name: 'Vikram Malhotra',phone: '+919000000006' },
  { email: 'ananya@bumperbid.test',name: 'Ananya Gupta',   phone: '+919000000007' },
  { email: 'suresh@bumperbid.test',name: 'Suresh Reddy',   phone: '+919000000008' },
  { email: 'kavita@bumperbid.test',name: 'Kavita Nair',    phone: '+919000000009' },
  { email: 'rahul@bumperbid.test', name: 'Rahul Verma',    phone: '+919000000010' },
];

const VEHICLES = [
  {
    title: '2021 Hyundai Creta SX — Single Owner',
    description:
      'Well-maintained Creta SX diesel with full service history. Single owner, kept in covered parking, all services at authorized service center. Ready for immediate registration transfer.',
    make: 'Hyundai',
    modelName: 'Creta',
    year: 2021,
    kmDriven: 32500,
    fuelType: 'diesel',
    city: 'Bengaluru',
    imageUrls: [
      'https://images.unsplash.com/photo-1549924231-f129b911e442?w=1200',
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200',
    ],
    startingPrice: 1_080_000_00, // ₹10.8L in paisa
    minIncrement: 5_000_00,
    reservePrice: 1_150_000_00,
  },
  {
    title: '2019 Maruti Suzuki Swift VXI — Pristine Condition',
    description:
      'Compact hatchback, petrol, manual. Used by a lady owner for city commute only. Full insurance valid till 2027. Zero accidents, all papers clean.',
    make: 'Maruti Suzuki',
    modelName: 'Swift',
    year: 2019,
    kmDriven: 41200,
    fuelType: 'petrol',
    city: 'Mumbai',
    imageUrls: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200',
    ],
    startingPrice: 460_000_00,
    minIncrement: 2_500_00,
    reservePrice: 520_000_00,
  },
  {
    title: '2022 Tata Nexon EV XZ+ — Ziptron',
    description:
      'Electric SUV, flagship variant. 312 km ARAI range, fast charger included. Under manufacturer warranty till Oct 2029. Single owner, purchased from authorized dealer.',
    make: 'Tata',
    modelName: 'Nexon EV',
    year: 2022,
    kmDriven: 18900,
    fuelType: 'ev',
    city: 'Pune',
    imageUrls: [
      'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200',
    ],
    startingPrice: 1_320_000_00,
    minIncrement: 10_000_00,
    reservePrice: 1_450_000_00,
  },
  {
    title: '2020 Honda City ZX CVT — Automatic',
    description:
      'Premium sedan, top variant, CVT automatic. Sunroof, leather seats, cruise control. Company-fitted accessories. Hyderabad registration, HSRP done.',
    make: 'Honda',
    modelName: 'City',
    year: 2020,
    kmDriven: 48000,
    fuelType: 'petrol',
    city: 'Hyderabad',
    imageUrls: [
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200',
    ],
    startingPrice: 1_180_000_00,
    minIncrement: 5_000_00,
    reservePrice: 1_280_000_00,
  },
  {
    title: '2018 Mahindra XUV500 W11 — 7-Seater',
    description:
      '7-seater SUV, top variant, 4x2. Sunroof, leather seats, hill descent control. Extensive highway use. Full service record available.',
    make: 'Mahindra',
    modelName: 'XUV500',
    year: 2018,
    kmDriven: 89400,
    fuelType: 'diesel',
    city: 'Delhi',
    imageUrls: [
      'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200',
    ],
    startingPrice: 920_000_00,
    minIncrement: 5_000_00,
    reservePrice: 1_020_000_00,
  },
  {
    title: '2023 Kia Seltos HTX — Petrol DCT',
    description:
      'Mid-size SUV, automatic DCT, petrol. 10.25" infotainment, LED headlamps, ventilated seats. Under warranty till 2026. Accident-free.',
    make: 'Kia',
    modelName: 'Seltos',
    year: 2023,
    kmDriven: 12400,
    fuelType: 'petrol',
    city: 'Chennai',
    imageUrls: [
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1200',
    ],
    startingPrice: 1_580_000_00,
    minIncrement: 10_000_00,
    reservePrice: 1_720_000_00,
  },
  {
    title: '2017 Toyota Innova Crysta ZX — 7-Seater',
    description:
      'Flagship MPV, 2.8L diesel, automatic. 7-seater captain chair configuration. Company-maintained, full service records at Toyota workshop.',
    make: 'Toyota',
    modelName: 'Innova Crysta',
    year: 2017,
    kmDriven: 112000,
    fuelType: 'diesel',
    city: 'Ahmedabad',
    imageUrls: [
      'https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1200',
    ],
    startingPrice: 1_650_000_00,
    minIncrement: 10_000_00,
    reservePrice: 1_800_000_00,
  },
  {
    title: '2021 MG Hector Plus Sharp — 6-Seater',
    description:
      '6-seater captain chair SUV, panoramic sunroof, 14" infotainment. Top variant with ADAS. Single-owner, company maintained.',
    make: 'MG',
    modelName: 'Hector Plus',
    year: 2021,
    kmDriven: 28500,
    fuelType: 'diesel',
    city: 'Kolkata',
    imageUrls: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200',
    ],
    startingPrice: 1_880_000_00,
    minIncrement: 10_000_00,
    reservePrice: 2_050_000_00,
  },
  {
    title: '2019 Renault Triber RXZ — Family MPV',
    description:
      'Affordable 7-seater, petrol, manual. Compact dimensions, flexible seating. Ideal for daily city commute and weekend trips.',
    make: 'Renault',
    modelName: 'Triber',
    year: 2019,
    kmDriven: 55000,
    fuelType: 'petrol',
    city: 'Jaipur',
    imageUrls: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200',
    ],
    startingPrice: 560_000_00,
    minIncrement: 2_500_00,
    reservePrice: 620_000_00,
  },
  {
    title: '2020 Ford EcoSport Titanium — SUV',
    description:
      'Compact SUV, top variant, petrol. Sunroof, leather, 9" infotainment. Ford service history. Accident-free.',
    make: 'Ford',
    modelName: 'EcoSport',
    year: 2020,
    kmDriven: 44500,
    fuelType: 'petrol',
    city: 'Lucknow',
    imageUrls: [
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200',
    ],
    startingPrice: 740_000_00,
    minIncrement: 5_000_00,
    reservePrice: 820_000_00,
  },
];

async function upsertUsers() {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  const created = [];
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.name, phone: u.phone },
      create: {
        email: u.email,
        phone: u.phone,
        passwordHash: hash,
        provider: 'email' as AuthProvider,
        displayName: u.name,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: 5_00_000_00 }, // ₹5,00,000 in paisa
      create: { userId: user.id, balance: 5_00_000_00, heldBalance: 0 },
    });
    created.push(user);
  }
  return created;
}

async function clearAuctions() {
  await prisma.bid.deleteMany({});
  await prisma.walletHold.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auction.deleteMany({});
}

async function createAuctions(users: { id: string; email: string | null }[]) {
  const now = Date.now();
  const minute = 60_000;

  // 5 LIVE auctions
  const liveSpecs = [
    { v: 0, sellerIdx: 0, endsInMin: 5 },
    { v: 1, sellerIdx: 1, endsInMin: 12 },
    { v: 2, sellerIdx: 2, endsInMin: 18 },
    { v: 3, sellerIdx: 3, endsInMin: 25 },
    { v: 4, sellerIdx: 4, endsInMin: 30 },
  ];
  for (const s of liveSpecs) {
    const v = VEHICLES[s.v];
    await prisma.auction.create({
      data: {
        ...v,
        sellerId: users[s.sellerIdx].id,
        status: 'live' as AuctionStatus,
        startsAt: new Date(now - 5 * minute),
        endsAt: new Date(now + s.endsInMin * minute),
        currentHighBid: v.startingPrice,
        bidCount: 0,
      },
    });
  }

  // 3 SCHEDULED auctions
  const schedSpecs = [
    { v: 5, sellerIdx: 5, startsInMin: 10 },
    { v: 6, sellerIdx: 6, startsInMin: 30 },
    { v: 7, sellerIdx: 7, startsInMin: 60 },
  ];
  for (const s of schedSpecs) {
    const v = VEHICLES[s.v];
    await prisma.auction.create({
      data: {
        ...v,
        sellerId: users[s.sellerIdx].id,
        status: 'scheduled' as AuctionStatus,
        startsAt: new Date(now + s.startsInMin * minute),
        endsAt: new Date(now + (s.startsInMin + 30) * minute),
        currentHighBid: v.startingPrice,
        bidCount: 0,
      },
    });
  }

  // 2 ENDED auctions (with winners)
  const endedSpecs = [
    { v: 8, sellerIdx: 8, winnerIdx: 0, endedHoursAgo: 3 },
    { v: 9, sellerIdx: 9, winnerIdx: 1, endedHoursAgo: 28 },
  ];
  for (const s of endedSpecs) {
    const v = VEHICLES[s.v];
    const finalPrice = v.startingPrice + 5 * v.minIncrement;
    await prisma.auction.create({
      data: {
        ...v,
        sellerId: users[s.sellerIdx].id,
        status: 'ended' as AuctionStatus,
        startsAt: new Date(now - (s.endedHoursAgo + 1) * 60 * minute),
        endsAt: new Date(now - s.endedHoursAgo * 60 * minute),
        endedAt: new Date(now - s.endedHoursAgo * 60 * minute),
        currentHighBid: finalPrice,
        finalPrice,
        winnerId: users[s.winnerIdx].id,
        bidCount: 6,
      },
    });
  }
}

async function main() {
  console.log('== BumperBid seed starting ==');
  const users = await upsertUsers();
  console.log(`  users: ${users.length}`);
  await clearAuctions();
  await createAuctions(users);
  const count = await prisma.auction.count();
  console.log(`  auctions: ${count}`);
  console.log('');
  console.log('Test credentials:');
  console.log('  email:    admin@bumperbid.test');
  console.log('  password: bumperbid123');
  console.log('');
  console.log('Every seeded user has the same password (for dev only).');
  console.log('== seed complete ==');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
