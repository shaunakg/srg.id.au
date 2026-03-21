import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getKnownImageDimensions, setKnownImageDimensions, type ImageDimensions } from './image-metadata-map';

export type { ImageDimensions } from './image-metadata-map';
export { getKnownImageDimensions } from './image-metadata-map';

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
const imageMetadataCache = new Map<string, Promise<ImageDimensions | undefined>>();

function parseNumericDimension(value?: string | null) {
  if (!value) return undefined;

  const match = value.match(/[\d.]+/);
  if (!match) return undefined;

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMimeType(format?: string) {
  if (!format) return undefined;
  if (format === 'svg') return 'image/svg+xml';
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
  return `image/${format}`;
}

async function readSvgDimensions(filePath: string) {
  const source = await readFile(filePath, 'utf8');
  const width = parseNumericDimension(source.match(/\bwidth=(['"])(.*?)\1/i)?.[2]);
  const height = parseNumericDimension(source.match(/\bheight=(['"])(.*?)\1/i)?.[2]);

  if (width && height) {
    return { width, height, mimeType: 'image/svg+xml' } satisfies ImageDimensions;
  }

  const viewBox = source.match(/\bviewBox=(['"])\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*\1/i);
  const viewBoxWidth = parseNumericDimension(viewBox?.[4]);
  const viewBoxHeight = parseNumericDimension(viewBox?.[5]);

  if (viewBoxWidth && viewBoxHeight) {
    return { width: viewBoxWidth, height: viewBoxHeight, mimeType: 'image/svg+xml' } satisfies ImageDimensions;
  }

  return undefined;
}

async function readPublicImageDimensions(src: string) {
  if (!src.startsWith('/')) return undefined;

  const relativePath = src.replace(/^\/+/, '');
  const filePath = path.join(publicDir, relativePath);

  if (src.toLowerCase().endsWith('.svg')) {
    return readSvgDimensions(filePath);
  }

  const metadata = await sharp(filePath, { animated: true }).metadata();
  if (!metadata.width || !metadata.height) return undefined;

  return {
    width: metadata.width,
    height: metadata.height,
    mimeType: getMimeType(metadata.format),
  } satisfies ImageDimensions;
}

export async function getImageDimensions(src: string) {
  const known = getKnownImageDimensions(src);
  if (known) {
    return known;
  }

  if (!imageMetadataCache.has(src)) {
    imageMetadataCache.set(
      src,
      readPublicImageDimensions(src)
        .then((dimensions) => {
          if (dimensions) {
            setKnownImageDimensions(src, dimensions);
          }
          return dimensions;
        })
        .catch(() => undefined),
    );
  }

  return imageMetadataCache.get(src)!;
}
