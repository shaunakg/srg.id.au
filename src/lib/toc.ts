export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

function normalizeHeadingText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeHeadingSlug(value: string) {
  return value.trim().replace(/[-_\s]+/g, '-').toLowerCase();
}

function isFootnotesHeading(heading: TocHeading) {
  const text = normalizeHeadingText(heading.text);
  const slug = normalizeHeadingSlug(heading.slug);

  return text === 'footnotes' || slug === 'footnotes' || slug === 'footnote-label';
}

export function filterTocHeadings(headings: TocHeading[]) {
  return headings.filter((heading) => heading.depth <= 3 && !isFootnotesHeading(heading));
}
