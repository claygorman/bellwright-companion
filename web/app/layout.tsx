import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from 'next/font/google';
import './globals.css';

const spectral = Spectral({
  weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-spectral',
});
const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-plex-sans',
});
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'Bellwright Companion',
  description: 'Self-hosted companion for Bellwright — roster, storage and map parsed live from save files',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className="dark">
    <body className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}>
      {children}
    </body>
  </html>
);

export default RootLayout;
