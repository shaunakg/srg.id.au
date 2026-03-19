import rss from '@astrojs/rss';
import { getPublishedPosts, getPostSlug } from '../lib/posts';

export async function GET(context) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'Shaunak Gadkari',
    description: 'Writing on medicine, AI, and projects I\'m building.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${getPostSlug(post)}/`,
    })),
  });
}
