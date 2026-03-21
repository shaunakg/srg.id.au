export interface ImageDimensions {
  width: number;
  height: number;
  mimeType?: string;
}

const imageMetadata: Record<string, ImageDimensions> = {
  '/images/ormond.jpeg': { width: 5744, height: 2456, mimeType: 'image/jpeg' },
  '/images/monash.svg': { width: 39, height: 42, mimeType: 'image/svg+xml' },
  '/images/latrobe.png': { width: 530, height: 471, mimeType: 'image/png' },
  '/images/jmss-bw.webp': { width: 1856, height: 1856, mimeType: 'image/webp' },
  '/og.png': { width: 1200, height: 630, mimeType: 'image/png' },
  '/posts/building-cardz/flashcards-og.webp': { width: 1200, height: 627, mimeType: 'image/webp' },
  '/posts/notes/og-bg.png': { width: 2132, height: 1294, mimeType: 'image/png' },
  'https://cdn.srg.id.au/notes-header.webp': { width: 2400, height: 1260, mimeType: 'image/webp' },
  'https://cdn.srg.id.au/notes-og.jpg': { width: 1200, height: 630, mimeType: 'image/jpeg' },
};

export function getKnownImageDimensions(src: string) {
  return imageMetadata[src];
}

export function setKnownImageDimensions(src: string, dimensions: ImageDimensions) {
  imageMetadata[src] = dimensions;
}
