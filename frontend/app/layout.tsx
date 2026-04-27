import type { Metadata, Viewport } from 'next';
import { Iceland, Inter } from 'next/font/google';
import './globals.css';

// Inter is the workhorse face - used for body text AND headings/UI
// chrome that previously called out a separate "display" font. By
// pointing both --font-inter and --font-display at it we keep the
// existing font-display Tailwind class working without rewriting every
// component, and the dashboard ends up looking like a clean fintech app
// (Stripe / Linear vibe) instead of a sci-fi console.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Inter({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Iceland is kept for the BUMPERBID brand lockup (wordmark) only - it
// shows up on the splash + auth screen and nowhere else.
const wordmark = Iceland({
  subsets: ['latin'],
  variable: '--font-wordmark',
  weight: '400',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BumperBid Auctions - A unit of Zidan Auto Pvt Ltd.',
  description:
    'BumperBid - premium vehicle auctions. Sign in with your mobile number to bid on curated inventory.',
  applicationName: 'BumperBid',
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${wordmark.variable}`}
    >
      <body className="min-h-screen bg-ink text-bone antialiased">
        {children}
      </body>
    </html>
  );
}
