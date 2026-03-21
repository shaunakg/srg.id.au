import { getCollection, type CollectionEntry } from 'astro:content';
import { readingMinutes, slugifyTag } from './site';

export type PostEntry = CollectionEntry<'posts'>;

function shouldIncludeDraftPosts() {
  return import.meta.env.DEV;
}

export async function getAllPosts() {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPublishedPosts() {
  const posts = await getAllPosts();
  if (shouldIncludeDraftPosts()) {
    return posts;
  }

  return posts.filter((post) => !post.data.draft);
}

export async function getPostReadingTime(post: PostEntry) {
  return readingMinutes(post.body ?? '');
}

export async function getAllTags() {
  const posts = await getPublishedPosts();
  const tags = new Map<string, { tag: string; slug: string; count: number }>();

  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      const slug = slugifyTag(tag);
      const current = tags.get(slug);
      tags.set(slug, {
        tag,
        slug,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return [...tags.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getPostSlug(post: PostEntry) {
  return post.data.slug ?? post.id.replace(/\.(md|mdx)$/i, '').split('/').pop() ?? post.id;
}

export function getPostHref(post: PostEntry) {
  return post.data.externalLink ?? `/posts/${getPostSlug(post)}/`;
}

export function isExternalHref(href: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(href);
}

export function isPublishedPostPage(post: PostEntry) {
  return !post.data.externalLink;
}

export async function getPostsByTag(tagSlug: string) {
  const posts = await getPublishedPosts();
  return posts.filter((post) => (post.data.tags ?? []).some((tag) => slugifyTag(tag) === tagSlug));
}
