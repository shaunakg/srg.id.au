import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';

const argv = process.argv.join(' ');
const lifecycle = process.env.npm_lifecycle_event ?? '';
const isCheckProcess = lifecycle === 'check' || /\bcheck\b/.test(argv);

export default defineConfig({
  site: 'https://srg.id.au',
  trailingSlash: 'always',
  adapter: cloudflare({
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  integrations: [mdx({ remarkPlugins: [remarkGfm] }), react(), sitemap()],
  prefetch: false,
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
    cacheDir: isCheckProcess ? 'node_modules/.vite-check' : 'node_modules/.vite',
    optimizeDeps: {
      include: [
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-types.js',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-swap-functions.js',
      ],
    },
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
