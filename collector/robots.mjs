import { USER_AGENT, USER_AGENT_PRODUCT } from './constants.mjs';

function stripComment(line) {
  const index = line.indexOf('#');
  return (index >= 0 ? line.slice(0, index) : line).trim();
}

export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      if (value) current.userAgents.push(value.toLowerCase());
      continue;
    }
    if ((field === 'allow' || field === 'disallow') && current?.userAgents.length) {
      // An empty Disallow means no restriction and can be ignored.
      if (value) current.rules.push({ directive: field, path: value });
    }
  }
  return groups;
}

function matchingGroups(groups, userAgent) {
  const normalized = userAgent.toLowerCase();
  const product = normalized.split(/[\s/]/)[0];
  const exact = groups.filter((group) => group.userAgents.some((entry) => entry !== '*' && (product.startsWith(entry) || normalized.includes(entry))));
  return exact.length ? exact : groups.filter((group) => group.userAgents.includes('*'));
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function ruleMatches(path, rulePath) {
  const anchored = rulePath.endsWith('$');
  const withoutAnchor = anchored ? rulePath.slice(0, -1) : rulePath;
  const pattern = escapeRegex(withoutAnchor).replace(/\*/g, '.*');
  return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path);
}

export function isAllowedByRobots(targetUrl, groups, userAgent = USER_AGENT_PRODUCT) {
  const url = new URL(targetUrl);
  const path = `${url.pathname}${url.search}` || '/';
  const matches = matchingGroups(groups, userAgent)
    .flatMap((group) => group.rules)
    .filter((rule) => ruleMatches(path, rule.path))
    .sort((a, b) => b.path.length - a.path.length || (a.directive === 'allow' ? -1 : 1));
  return matches.length === 0 || matches[0].directive === 'allow';
}

export async function checkRobots(targetUrl, options = {}) {
  const target = new URL(targetUrl);
  const robotsUrl = new URL('/robots.txt', target.origin).toString();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(robotsUrl, {
      headers: { Accept: 'text/plain', 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if ([404, 410].includes(response.status)) {
      return { allowed: true, status: 'missing', robotsUrl, reason: `robots.txt returned HTTP ${response.status}` };
    }
    if ([401, 403].includes(response.status)) {
      return { allowed: false, status: 'blocked', robotsUrl, reason: `robots.txt returned HTTP ${response.status}` };
    }
    if (!response.ok) {
      return { allowed: false, status: 'unavailable', robotsUrl, reason: `robots.txt could not be verified (HTTP ${response.status})` };
    }
    const finalUrl = new URL(response.url || robotsUrl);
    if (finalUrl.origin !== target.origin) {
      return { allowed: false, status: 'unavailable', robotsUrl, reason: 'robots.txt redirected to a different origin' };
    }
    const text = await response.text();
    const groups = parseRobots(text);
    const allowed = isAllowedByRobots(targetUrl, groups);
    return {
      allowed,
      status: allowed ? 'allowed' : 'blocked',
      robotsUrl,
      reason: allowed ? 'robots.txt permits this path' : 'robots.txt disallows this path',
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? 'robots.txt check timed out'
      : 'robots.txt could not be verified';
    return { allowed: false, status: 'unavailable', robotsUrl, reason };
  } finally {
    clearTimeout(timer);
  }
}

