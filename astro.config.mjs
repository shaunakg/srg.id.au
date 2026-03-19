import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  site: 'https://srg.id.au',
  trailingSlash: 'always',
  adapter: cloudflare({
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  integrations: [mdx({ remarkPlugins: [remarkGfm] }), react(), sitemap()],
  image: {
    domains: ['cdn.srg.id.au'],
  },
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
