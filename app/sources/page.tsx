import type { Metadata } from 'next';
import Link from 'next/link';
import packageInfo from '../../package.json';
import { librarySources } from '../../collector/sources.mjs';
import SiteHeader from '@/app/site-header';
import { structuredSources, type FeedConfig, type FeedType } from '@/lib/source-catalog';

export const metadata: Metadata = {
  title: 'Sources & technology | Library Loop',
  description: 'The complete configured source directory, collection parameters, safeguards, and technology behind Library Loop.',
};

type BrowserSource = {
  id: string;
  name: string;
  distance: number;
  status: 'page' | 'manual';
  method: string;
  note: string;
  url: string;
  alternateUrls?: string[];
  collectionMode: string;
  enabled: boolean;
  requiresVisualReview: boolean;
};

const browserSources = librarySources as readonly BrowserSource[];
const totalSources = structuredSources.length + browserSources.length;

const adapterLabels: Record<FeedType, string> = {
  librarycalendar: 'LibraryCalendar JSON',
  tribe: 'WordPress Events API',
  civicplus: 'iCalendar (ICS)',
  squarespace: 'Squarespace JSON',
  communico: 'Communico JSON',
  rss: 'RSS',
  bibliocommons: 'BiblioCommons RSS',
  mycalendar: 'My Calendar API',
};

const kindOrder = ['Library', 'Park district', 'Recreation', 'Forest preserve'] as const;

function formatDistance(distance: number) {
  return Number.isInteger(distance) ? distance.toFixed(1) : String(distance);
}

function sourceNotes(source: FeedConfig) {
  const notes: string[] = [];
  if (source.icsUtc) notes.push('UTC timestamps');
  if (source.maxPages) notes.push(`up to ${source.maxPages} pages`);
  if (source.venueDistance) notes.push('venue-level distance');
  if (source.branchRules?.length) notes.push(`${source.branchRules.length} branch rules`);
  if (source.strictBranchDistance) notes.push('strict in-radius branches');
  if (source.detailBase) notes.push('official detail-link template');
  return notes;
}

function StructuredSourceRow({ source }: { source: FeedConfig }) {
  const notes = sourceNotes(source);
  return (
    <li className="source-row">
      <div className="source-name">
        <a href={source.endpoint} target="_blank" rel="noopener noreferrer">{source.name} <span aria-hidden="true">↗</span></a>
        <code>{source.id}</code>
      </div>
      <div className="source-meta"><strong>{adapterLabels[source.type]}</strong><span>{source.sourceKind}</span></div>
      <div className="source-distance"><strong>{formatDistance(source.distance)} mi</strong><span>from 60457</span></div>
      <div className="source-address"><span>{source.address}</span>{notes.length ? <small>{notes.join(' · ')}</small> : null}</div>
      <a className="source-endpoint" href={source.endpoint} target="_blank" rel="noopener noreferrer">{source.endpoint}</a>
      {(source.branchRules?.length || source.detailBase || source.multiBranchAddress) ? <details className="source-settings">
        <summary>Source-specific configuration</summary>
        {source.multiBranchAddress ? <p><strong>Fallback location:</strong> {source.multiBranchAddress}</p> : null}
        {source.detailBase ? <p><strong>Detail-link template:</strong> <a href={source.detailBase} target="_blank" rel="noopener noreferrer">{source.detailBase}</a></p> : null}
        {source.branchRules?.length ? <ul>{source.branchRules.map((rule) => <li key={`${source.id}-${rule.match}`}><strong>{rule.match}</strong> · {formatDistance(rule.distance)} mi · {rule.address}</li>)}</ul> : null}
      </details> : null}
    </li>
  );
}

const parameterGroups = [
  {
    title: 'Public calendar',
    items: [
      ['Home area', 'ZIP 60457; reference center 41.7244, -87.8273'],
      ['Visitor window', '7 days; API accepts 1–7 days'],
      ['Distance', '5, 10, or 15 mile filters; uploads validate at 15.5 miles or less'],
      ['Time zone', 'America/Chicago; displayed in local Central time'],
      ['Default audience', 'Ages 7–16 overlap; clearly teen-only events are opt-in'],
      ['Page size', '24 event cards at a time'],
      ['Saved API cache', '120 seconds, plus 600 seconds stale-while-revalidate'],
      ['Stale threshold', '36 hours before saved coverage is labeled stale'],
    ],
  },
  {
    title: 'Structured collection',
    items: [
      ['Configured sources', `${structuredSources.length} official feeds`],
      ['Parallelism', '5 feeds at a time'],
      ['Request timeout', '12 seconds per request'],
      ['robots.txt timeout', '8 seconds'],
      ['Redirect policy', 'HTTPS only; same origin only; at most 3 redirects'],
      ['Saved feed cache', '300 seconds for unauthenticated structured reads'],
      ['Feed formats', 'JSON, REST, ICS, RSS, BiblioCommons, Communico, My Calendar, and Squarespace'],
    ],
  },
  {
    title: 'Overnight browser collection',
    items: [
      ['Configured sources', `${browserSources.length} reviewed official public pages`],
      ['Collection window', '60 future days; command accepts 1–180 days'],
      ['Execution', 'Sequential, headless by default, using system Edge or Chrome'],
      ['Navigation timeout', '30 seconds per page; command accepts 1–120 seconds'],
      ['Settle delay', '1.5 seconds; command accepts 0–15 seconds'],
      ['robots.txt timeout', '10 seconds'],
      ['Upload timeout', '30 seconds'],
      ['Browser context', 'en-US, America/Chicago, service workers blocked'],
      ['Cadence', '2:15 AM primary; 4:00 AM duplicate-safe fallback'],
    ],
  },
  {
    title: 'Validation & persistence',
    items: [
      ['Authentication', 'HMAC-SHA256 signed batches; no secret values in Git or this page'],
      ['Clock tolerance', '5 minutes'],
      ['Per-source limit', '200 accepted events'],
      ['Per-batch limit', '3,000 accepted events'],
      ['Upload size', '1,500,000 UTF-8 bytes'],
      ['Descriptions', '420 characters in the overnight normalizer'],
      ['Writes', 'Reviewed source IDs only; idempotent run IDs; atomic D1 updates'],
      ['Last-known-good', 'Empty, failed, blocked, or stale results do not erase newer usable events'],
    ],
  },
  {
    title: 'Field & audit bounds',
    items: [
      ['Page scan', 'Up to 240 semantic event nodes and 151 extracted DOM candidates per page'],
      ['Event text', 'Title 240; source 180; venue 240; address 360 characters'],
      ['Description', '420 characters after browser normalization; server contract allows 600'],
      ['URLs & notices', 'HTTPS URL 1,200; schedule notice 180 characters'],
      ['Errors', '500 characters per source result'],
      ['Audit samples', 'Up to 100 review items and 50 excluded examples per source'],
      ['Collector identity', 'library-loop-browser-v1; transparent LibraryLoopCollector/1.0 user agent'],
      ['Structured identity', 'Transparent LibraryLoop/1.0 user agent'],
    ],
  },
] as const;

const stack = [
  ['Application', `Next ${packageInfo.dependencies.next}, React ${packageInfo.dependencies.react}, TypeScript ${packageInfo.devDependencies.typescript}`],
  ['Build/runtime', `Vinext ${packageInfo.devDependencies.vinext}, Vite ${packageInfo.devDependencies.vite}, Cloudflare Workers`],
  ['Hosting/data', 'OpenAI Sites with a Cloudflare D1 persisted read model'],
  ['Deployment tools', `OpenAI Sites plugin 0.2.0, Cloudflare Vite plugin ${packageInfo.devDependencies['@cloudflare/vite-plugin']}, Wrangler ${packageInfo.devDependencies.wrangler}`],
  ['React build', `Vite React plugin ${packageInfo.devDependencies['@vitejs/plugin-react']}, React Server Components plugin ${packageInfo.devDependencies['@vitejs/plugin-rsc']}`],
  ['Styling', `Custom responsive CSS through the Tailwind/PostCSS ${packageInfo.devDependencies.tailwindcss} toolchain`],
  ['Collection', `Node.js ${packageInfo.engines.node}, Playwright Core ${packageInfo.devDependencies['playwright-core']}, JavaScript ES modules`],
  ['Scheduling', 'Windows Task Scheduler with a PowerShell entry point'],
  ['Package manager', `pnpm ${packageInfo.packageManager.replace('pnpm@', '')}`],
  ['Quality checks', `Node test runner, ESLint ${packageInfo.devDependencies.eslint}, GitHub Actions`],
] as const;

export default function SourcesPage() {
  const adapterCounts = structuredSources.reduce<Record<string, number>>((counts, source) => {
    const label = adapterLabels[source.type];
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
      <SiteHeader active="sources" />
      <main id="main-content" className="reference-page">
        <section className="reference-hero" aria-labelledby="page-title">
          <div>
            <p className="kicker">Public source directory</p>
            <h1 id="page-title">Sources &amp; technology.</h1>
            <p>This is the full configured roster behind Library Loop: every source, every public operating limit, and the exact stack used to build the saved calendar.</p>
          </div>
          <div className="source-total" aria-label={`${totalSources} configured sources`}><strong>{totalSources}</strong><span>configured sources</span><small>{structuredSources.length} feeds + {browserSources.length} browser pages</small></div>
        </section>

        <nav className="reference-jump" aria-label="On this page">
          <a href="#sources">All sources</a><a href="#parameters">Parameters</a><a href="#stack">Tech stack</a><a href="#code">Code on GitHub</a>
        </nav>

        <section className="reference-section methodology" aria-labelledby="method-title">
          <div className="section-heading"><p className="kicker">How it works</p><h2 id="method-title">Collected ahead of time. Fast for visitors.</h2></div>
          <ol className="process-grid">
            <li><span>1</span><div><strong>Collect</strong><p>Reviewed feeds and official public pages are checked on a daily schedule.</p></div></li>
            <li><span>2</span><div><strong>Validate</strong><p>Dates, distance, audience, URLs, duplicates, and source identity are checked conservatively.</p></div></li>
            <li><span>3</span><div><strong>Save</strong><p>One merged D1 snapshot is served, so visitors do not wait on dozens of outside calendars.</p></div></li>
          </ol>
          <div className="safety-note"><strong>Safe-stop rules</strong><p>Both collection lanes honor robots.txt. They stop at login, password fields, CAPTCHA, anti-bot challenges, access denied, unreviewed redirects, stale writes, or ambiguous content. Organizers remain the authority for final details.</p></div>
        </section>

        <section id="sources" className="reference-section" aria-labelledby="sources-title">
          <div className="section-heading"><p className="kicker">Complete configured roster</p><h2 id="sources-title">All {totalSources} sources</h2><p>“Configured” does not mean every source is responding today. The event page reports the current saved coverage honestly.</p></div>
          <div className="source-summary" aria-label="Source breakdown">
            {Object.entries(adapterCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => <span key={label}><strong>{count}</strong> {label}</span>)}
            <span><strong>{browserSources.length}</strong> browser pages</span>
          </div>

          <div className="source-lane">
            <div className="lane-heading"><div><p className="kicker">Lane one</p><h3>Structured feeds</h3></div><strong>{structuredSources.length}</strong></div>
            <p className="lane-copy">Direct, machine-readable feeds from reviewed official organizations. The collection adapter reads the endpoint shown on each row.</p>
            {kindOrder.map((kind) => {
              const sources = structuredSources.filter((source) => source.sourceKind === kind).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
              return <section className="source-group" aria-labelledby={`kind-${kind.replaceAll(' ', '-')}`} key={kind}>
                <h4 id={`kind-${kind.replaceAll(' ', '-')}`}>{kind}<span>{sources.length}</span></h4>
                <ul className="source-list">{sources.map((source) => <StructuredSourceRow source={source} key={source.id} />)}</ul>
              </section>;
            })}
          </div>

          <div className="source-lane browser-lane">
            <div className="lane-heading"><div><p className="kicker">Lane two</p><h3>Overnight browser pages</h3></div><strong>{browserSources.length}</strong></div>
            <p className="lane-copy">Official public pages used when a dependable structured feed is not available. Manual-design pages remain subject to the same conservative publication rules.</p>
            <ul className="source-list browser-source-list">
              {[...browserSources].sort((a, b) => a.distance - b.distance).map((source) => <li className="source-row" key={source.id}>
                <div className="source-name"><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} <span aria-hidden="true">↗</span></a><code>{source.id}</code></div>
                <div className="source-meta"><strong>{source.method}</strong><span>{source.status === 'manual' ? 'Manual-design page' : 'Browser page'}</span></div>
                <div className="source-distance"><strong>{formatDistance(source.distance)} mi</strong><span>from 60457</span></div>
                <div className="source-address"><span>{source.note}</span><small>{source.requiresVisualReview ? 'Visual review required' : 'Semantic page extraction'}</small></div>
                <div className="source-endpoints"><a className="source-endpoint" href={source.url} target="_blank" rel="noopener noreferrer">Primary: {source.url}</a>{source.alternateUrls?.map((url) => <a className="source-endpoint" href={url} target="_blank" rel="noopener noreferrer" key={url}>Reviewed alternate: {url}</a>)}</div>
              </li>)}
            </ul>
          </div>
        </section>

        <section id="parameters" className="reference-section" aria-labelledby="parameters-title">
          <div className="section-heading"><p className="kicker">Public operating reference</p><h2 id="parameters-title">Technical parameters</h2><p>These are the current non-secret defaults and enforced limits. Credentials, token values, and internal deployment identifiers are intentionally excluded.</p></div>
          <div className="parameter-grid">{parameterGroups.map((group) => <article className="parameter-card" key={group.title}><h3>{group.title}</h3><dl>{group.items.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl></article>)}</div>
        </section>

        <section id="stack" className="reference-section" aria-labelledby="stack-title">
          <div className="section-heading"><p className="kicker">Implementation</p><h2 id="stack-title">Technology stack</h2></div>
          <dl className="stack-list">{stack.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        </section>

        <section id="code" className="reference-section code-panel" aria-labelledby="code-title">
          <div><p className="kicker">Source code</p><h2 id="code-title">Project repository on GitHub</h2><p>The owner-controlled repository includes the application, collectors, source manifests, tests, database migrations, documentation, and PowerShell scheduled-task entry point. Access follows the repository’s permissions.</p><div className="code-actions"><a className="official-link" href="https://github.com/nilkamal11/library-loop-60457" target="_blank" rel="noopener noreferrer">Open the GitHub repository <span aria-hidden="true">↗</span></a><a href="https://github.com/nilkamal11/library-loop-60457/blob/main/docs/SOURCES_AND_TECH.md" target="_blank" rel="noopener noreferrer">Read the technical reference</a></div></div>
          <aside><strong>Python status</strong><p>No Python is used in the current project, so there is no Python file to share. The collector is Node.js/JavaScript with Playwright; Windows scheduling uses PowerShell. Both are included on GitHub.</p></aside>
        </section>

        <Link className="back-to-events" href="/">← Back to events</Link>
      </main>
      <footer><strong>Library Loop</strong><span>Transparent source coverage, conservative collection, and a fast saved calendar.</span><Link href="/">Browse events</Link></footer>
    </>
  );
}
