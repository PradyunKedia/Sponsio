/* oxlint-disable react/only-export-components */

import '../index.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Sponsio — 100 Seconds to Move a Room',
  description: 'A 100-second multiplayer coordination market settled on Monad.',
  manifest: '/site.webmanifest',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    title: 'Sponsio — 100 Seconds to Move a Room',
    description: 'Real players, equal headcount, loyalty-weighted rewards, settled on Monad.',
    images: ['/sponsio-social.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsio — Monad Arcade',
    description: 'A 100-second multiplayer coordination market settled on Monad.',
    images: ['/sponsio-social.svg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7B68EE',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
