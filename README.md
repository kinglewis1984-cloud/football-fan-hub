# Football Fan Hub

A website for football fans — live scores, Premier League table, and the latest news, all in one place.

## Features (Phase 1)

- Live scores and fixtures via ESPN's public soccer API (no signup/API key required)
- Premier League table, same source
- Latest football news via BBC Sport's RSS feed

## Coming later (Phase 2)

- Fan community: forum/chat, per-team or per-match discussion rooms

## Development

```
npm install
npx vercel dev
```

Uses Vercel serverless functions (`/api`), so `vercel dev` is needed instead of plain `vite dev` to run the API routes locally.
