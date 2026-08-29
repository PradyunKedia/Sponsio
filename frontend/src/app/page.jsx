'use client';

import dynamic from 'next/dynamic';

const SponsioApp = dynamic(() => import('../App.jsx'), {
  ssr: false,
  loading: () => <main className="app-loading">LOADING SPONSIO…</main>,
});

export default function HomePage() {
  return <SponsioApp />;
}
