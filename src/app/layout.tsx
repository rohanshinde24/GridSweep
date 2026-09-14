import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  subsets: ['latin'],
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GridSweep — Minesweeper',
  description:
    'Play Minesweeper with safe first moves, three difficulty levels, custom boards, and touch-friendly flag controls.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
