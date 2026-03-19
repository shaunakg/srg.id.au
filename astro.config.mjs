import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  site: 'https://srg.id.au',
  trailingSlash: 'always',
  integrations: [mdx({ remarkPlugins: [remarkGfm] }), sitemap()],
  markdown: {
    remarkPlugins: [remarkGfm],
    shikiConfig: {
      theme: 'solarized-light',
    },
  },
  vite: {
    server: {
      host: true,
      port: 4321,
    },
    preview: {
      host: true,
      port: 4321,
    },
  },
});
