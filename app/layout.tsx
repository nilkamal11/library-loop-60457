import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://library-loop-60457.nilkamals463352.chatgpt.site';

export const metadata: Metadata = {
  title: 'Library Loop | Kids events near 60457',
  description: 'Find saved, official library, park, recreation, and nature events for kids and families near ZIP 60457.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Library Loop | Find a good outing',
    description: 'A practical seven-day guide to kids and family events near 60457.',
    images: [{ url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: 'Library Loop — find a good outing near 60457' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Library Loop | Find a good outing',
    description: 'A practical seven-day guide to kids and family events near 60457.',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

