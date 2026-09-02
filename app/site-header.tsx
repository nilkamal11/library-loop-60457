import Link from 'next/link';

type SiteHeaderProps = {
  active: 'events' | 'sources';
  radius?: string;
};

export default function SiteHeader({ active, radius }: SiteHeaderProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Library Loop home">
          <span aria-hidden="true">LL</span><strong>Library Loop</strong>
        </Link>
        <nav className="primary-nav" aria-label="Primary">
          <Link className={`nav-link ${active === 'events' ? 'active' : ''}`} href="/" aria-current={active === 'events' ? 'page' : undefined}>Events</Link>
          <Link className={`nav-link ${active === 'sources' ? 'active' : ''}`} href="/sources" aria-current={active === 'sources' ? 'page' : undefined}>Sources &amp; tech</Link>
        </nav>
        <div className="location"><span aria-hidden="true">●</span><span className="location-label"><span className="location-near">Near </span>60457</span>{radius ? <b>within {radius} miles</b> : null}</div>
      </header>
    </>
  );
}
