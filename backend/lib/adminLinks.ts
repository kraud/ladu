/**
 * The "More detail in other tools" links on the admin health page. The real
 * addresses (the Sentry project, the Healthchecks project, the Netcup page...)
 * must not be in the repository, which is public. They come from the
 * `ADMIN_LINKS` environment variable, which the deploy writes into each
 * environment's `.env` from a GitHub Environment secret (deploy.yml).
 *
 * Format: ONE LINE of JSON. A list of `{ "label", "description"?, "href" }`.
 * It must be one line, because it is a single line of an `.env` file.
 *
 * All-or-nothing: if any entry is wrong, the whole value is `invalid`, and the
 * health page shows its generic fallback links plus a warning. A silent partial
 * list would hide a typo.
 */

export interface AdminLink {
  label: string;
  description: string;
  href: string;
}

export type LinksStatus = 'configured' | 'not_set' | 'invalid';

const MAX_LINKS = 30;
const MAX_LABEL = 60;
const MAX_DESCRIPTION = 120;
const MAX_HREF = 500;

type Parsed = { status: LinksStatus; links: AdminLink[]; problem?: string };

const invalid = (problem: string): Parsed => ({ status: 'invalid', links: [], problem });

// Parsed once per distinct value: the variable does not change while the
// process runs, and a bad value should log one warning, not one per request.
const cache = new Map<string, Parsed>();

const parse = (raw: string): Parsed => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return invalid('it is not valid JSON (it must be on one line, with double quotes)');
  }
  if (!Array.isArray(value) || value.length === 0) return invalid('it must be a non-empty list');
  if (value.length > MAX_LINKS) return invalid(`it has more than ${MAX_LINKS} links`);

  const links: AdminLink[] = [];
  for (const [index, entry] of value.entries()) {
    const where = `link ${index + 1}`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return invalid(`${where} is not an object`);
    const { label, description, href } = entry as Record<string, unknown>;

    if (typeof label !== 'string' || !label.trim() || label.trim().length > MAX_LABEL) {
      return invalid(`${where} needs a "label" of 1 to ${MAX_LABEL} characters`);
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION)) {
      return invalid(`${where} has a "description" that is not text of at most ${MAX_DESCRIPTION} characters`);
    }
    if (typeof href !== 'string' || href.length > MAX_HREF) return invalid(`${where} needs an "href"`);

    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return invalid(`${where} has an "href" that is not a full address`);
    }
    // https only: a `javascript:` or `data:` address would run code when clicked.
    if (url.protocol !== 'https:') return invalid(`${where} must start with https://`);

    links.push({ label: label.trim(), description: (description ?? '').trim(), href: url.href });
  }
  return { status: 'configured', links };
};

export const loadAdminLinks = (raw: string | undefined = process.env.ADMIN_LINKS): Parsed => {
  const text = (raw ?? '').trim();
  if (!text) return { status: 'not_set', links: [] };

  const cached = cache.get(text);
  if (cached) return cached;

  const result = parse(text);
  // The value itself is never logged: it holds the addresses this feature keeps private.
  if (result.problem) console.warn(`ADMIN_LINKS is set but not usable: ${result.problem}`);
  cache.set(text, result);
  return result;
};
