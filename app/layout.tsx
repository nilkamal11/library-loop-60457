import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://library-loop-60457.nilkamals463352.chatgpt.site';

export const metadata: Metadata = {
  title: 'Library Loop — Kids Library Events Near 60457',
  description: 'A daily calendar of nearby public-library events for kids ages 7–16.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Library Loop',
    description: 'Kids library events near 60457',
    images: [{ url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: 'Library Loop — Kids library events near 60457' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Library Loop',
    description: 'Kids library events near 60457',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
