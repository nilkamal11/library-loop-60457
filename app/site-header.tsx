/* eslint-disable @next/next/no-html-link-for-pages -- Native links avoid a vinext hosted-navigation runtime failure. */

type SiteHeaderProps = {
  active: 'events' | 'sources';
  radius?: string;
};

export default function SiteHeader({ active, radius }: SiteHeaderProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Library Loop home">
          <span aria-hidden="true">LL</span><strong>Library Loop</strong>
        </a>
        <nav className="primary-nav" aria-label="Primary">
          <a className={`nav-link ${active === 'events' ? 'active' : ''}`} href="/" aria-current={active === 'events' ? 'page' : undefined}>Events</a>
          <a className={`nav-link ${active === 'sources' ? 'active' : ''}`} href="/sources" aria-current={active === 'sources' ? 'page' : undefined}>Sources &amp; tech</a>
        </nav>
        <div className="location"><span aria-hidden="true">●</span><span className="location-label"><span className="location-near">Near </span>60457</span>{radius ? <b>within {radius} miles</b> : null}</div>
      </header>
    </>
  );
}
