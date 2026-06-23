# neo

Personal AI app prototype. The current version focuses on:

- AI-first capture and organization
- Memory notes with image/file attachments
- Codex task drafts
- AI HOT daily report sync from Hermes

## Local Development

```bash
npm install
npm run dev
```

Local app:

```text
http://127.0.0.1:5174/
```

The local Vite dev server proxies `/api/*` to the server-side `neo-api` and injects the private token from `.env.local`.

## Cloudflare Pages

Cloudflare Pages is the recommended mobile deployment target. It serves the app over HTTPS and uses `functions/api/[[path]].ts` as a private proxy to the server-side `neo-api`, so the API token is not shipped in browser JavaScript.

Build:

```bash
npm run build
```

Preview locally after build:

```bash
npm run cf:preview
```

Deploy:

```bash
npm run cf:deploy
```

Before the first deploy, set the Pages secret:

```bash
npx wrangler login
npx wrangler pages secret put NEO_API_TOKEN --project-name neo-personal-app
```

`NEO_API_BASE` is configured in `wrangler.toml`.
