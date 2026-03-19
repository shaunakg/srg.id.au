# srg.id.au

Personal site built with Astro and deployed on Cloudflare Workers.

## Local development

```bash
pnpm install
pnpm run dev
```

## Quality checks

```bash
pnpm run build
pnpm run check
```

## Cloudflare Workers setup

Set the Worker secret:

```bash
pnpm exec wrangler secret put LISTMONK_API_TOKEN
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
pnpm run cf:typegen
```

Build and preview the Worker locally:

```bash
pnpm run build
pnpm run preview
```

Deploy the Worker:

```bash
pnpm run deploy
```

For local preview or deploy, provide the Listmonk credentials through Wrangler secrets or local Worker vars before running the command.

## Notes

- Static assets that should be served as-is live in `public/`
- Blog content lives in `src/content/posts/`
- Worker output is generated into `dist/server/`, with the deploy config at `dist/server/wrangler.json`
- Newsletter subscriptions are proxied through the Worker endpoint in `src/pages/api/subscribe.ts`
