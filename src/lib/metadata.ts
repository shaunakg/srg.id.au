import { getKnownImageDimensions, type ImageDimensions } from './image-metadata';
import { absoluteUrl, site } from './site';

interface MetadataInput {
  pathname: string;
  baseUrl?: URL | string;
  title?: string;
  description?: string;
  ogImage?: string;
  ogImageAlt?: string;
  article?: boolean;
  publishedTime?: Date;
  featureImage?: string;
  tags?: string[];
  noindex?: boolean;
}

interface MetadataResult {
  canonicalUrl: string;
  pageTitle: string;
  socialTitle: string;
  description: string;
  robots: string;
  ogType: 'article' | 'website';
  ogImage: string;
  ogImageAlt: string;
  ogImageMetadata?: ImageDimensions;
  structuredData?: string;
}

const generatedOgImageMetadata: ImageDimensions = {
  width: 1200,
  height: 630,
  mimeType: 'image/png',
};

function resolveSiteUrl(baseUrl?: URL | string) {
  return new URL(baseUrl ?? `https://${site.domain}`);
}

function formatPageTitle(title?: string) {
  return !title || title === site.title ? site.title : `${title} | ${site.title}`;
}

function formatOgDate(value?: Date) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function buildGeneratedOgImage({
  baseUrl,
  title,
  description,
  publishedTime,
  featureImage,
}: {
  baseUrl: URL;
  title: string;
  description?: string;
  publishedTime?: Date;
  featureImage?: string;
}) {
  const params = new URLSearchParams({ title });

  if (description) {
    params.set('description', description);
  }

  const formattedDate = formatOgDate(publishedTime);
  if (formattedDate) {
    params.set('date', formattedDate);
  }

  if (featureImage) {
    params.set('bg', absoluteUrl(featureImage, baseUrl));
  }

  return `${site.ogImageService}?${params.toString()}`;
}

function buildStructuredData({
  pathname,
  title,
  description,
  canonicalUrl,
  ogImage,
  article,
  publishedTime,
  tags,
  noindex,
}: {
  pathname: string;
  title?: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
  article?: boolean;
  publishedTime?: Date;
  tags?: string[];
  noindex?: boolean;
}) {
  if (noindex) {
    return undefined;
  }

  if (article && title && publishedTime) {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      image: [ogImage],
      datePublished: publishedTime.toISOString(),
      author: {
        '@type': 'Person',
        name: site.author,
        url: `https://${site.domain}/`,
      },
      mainEntityOfPage: canonicalUrl,
      url: canonicalUrl,
      keywords: tags?.length ? tags.join(', ') : undefined,
      inLanguage: 'en-AU',
    });
  }

  if (pathname === '/') {
    return JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.title,
        description,
        url: canonicalUrl,
        inLanguage: 'en-AU',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: site.author,
        description,
        url: canonicalUrl,
        sameAs: [site.github, site.twitter],
      },
    ]);
  }

  return undefined;
}

export function buildPageMetadata({
  pathname,
  baseUrl,
  title,
  description = site.description,
  ogImage,
  ogImageAlt,
  article = false,
  publishedTime,
  featureImage,
  tags = [],
  noindex = false,
}: MetadataInput): MetadataResult {
  const siteUrl = resolveSiteUrl(baseUrl);
  const canonicalUrl = new URL(pathname, siteUrl).toString();
  const socialTitle = title ?? site.title;
  const pageTitle = formatPageTitle(title);

  const ogImageSource = ogImage
    ? ogImage
    : article && title
      ? buildGeneratedOgImage({
          baseUrl: siteUrl,
          title,
          description,
          publishedTime,
          featureImage,
        })
      : site.defaultOgImage;

  const resolvedOgImage = absoluteUrl(ogImageSource, siteUrl);
  const ogImageMetadata =
    getKnownImageDimensions(ogImageSource) ??
    (resolvedOgImage.startsWith(`${site.ogImageService}?`) ? generatedOgImageMetadata : undefined);

  return {
    canonicalUrl,
    pageTitle,
    socialTitle,
    description,
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    ogType: article ? 'article' : 'website',
    ogImage: resolvedOgImage,
    ogImageAlt: ogImageAlt ?? socialTitle,
    ogImageMetadata,
    structuredData: buildStructuredData({
      pathname,
      title,
      description,
      canonicalUrl,
      ogImage: resolvedOgImage,
      article,
      publishedTime,
      tags,
      noindex,
    }),
  };
}
