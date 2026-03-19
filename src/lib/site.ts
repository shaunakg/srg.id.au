export const site = {
  title: 'Shaunak Gadkari',
  description: 'Medical student and developer from Melbourne',
  author: 'Shaunak Gadkari',
  email: 'hi@srg.id.au',
  github: 'https://github.com/shaunakg',
  twitter: 'https://x.com/2vectorfoil',
  twitterHandle: '@2vectorfoil',
  domain: 'srg.id.au',
  newsletterEndpoint: '/api/subscribe',
  analyticsId: 'G-P80KQB5DMX',
  utterancesRepo: 'shaunakg/portfolio-zola',
  defaultOgImage: '/og.png',
  ogImageService: 'https://og.srg.id.au/api/og',
};

export function absoluteUrl(path: string, base: URL | string) {
  return new URL(path, base).toString();
}

export function formatDisplayDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(date);
}

export function formatMonthDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-AU', {
    month: 'short',
    day: '2-digit',
    timeZone: 'Australia/Melbourne',
  }).format(date);
}

export function slugifyTag(tag: string) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function readingMinutes(text: string) {
  const sanitized = text
    .replace(/^import\s.+$/gm, ' ')
    .replace(/^export\s.+$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .trim();
  const words = sanitized.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
