# srg.id.au

Personal site built with Astro and deployed on Cloudflare Pages.

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run build
npm run check
```

## Cloudflare Pages setup

Set these Pages secrets/variables:

```bash
npx wrangler secret put LISTMONK_API_TOKEN
```

- `LISTMONK_API_TOKEN`: required
- `LISTMONK_API_USER`: optional, defaults to `web`
- `LISTMONK_URL`: defaults to `https://lists.a.srg.id.au`
- `LISTMONK_LIST_ID`: defaults to `3`
- `ALLOWED_ORIGINS`: comma-separated allowed origins for CORS

The default `wrangler.jsonc` values already match production:

```bash
LISTMONK_URL=https://lists.a.srg.id.au
LISTMONK_LIST_ID=3
ALLOWED_ORIGINS=https://srg.id.au,https://www.srg.id.au
```

Generate local Cloudflare types when bindings change:

```bash
npm run cf:typegen
```

Build and run the site with Pages Functions locally when needed:

```bash
npm run build
npm run cf:dev
```

For local Pages Function testing, provide the Listmonk credentials in your shell before `npm run cf:dev`.

## Notes

- Static assets that should be served as-is live in `public/`
- Blog content lives in `src/content/posts/`
- Newsletter subscriptions are proxied through Cloudflare Pages in `functions/api/subscribe.ts`
