import './globals.css';
import { ReactNode } from 'react';
import { AuthGate } from '@/components/AuthGate';

export const metadata = { title: 'BumperBid Admin', description: 'Internal console' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
