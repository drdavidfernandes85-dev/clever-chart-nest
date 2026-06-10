# IX LTR — Educational Trading Platform & Trader Community

Web platform for the IX LTR (ixsalatrading.com) trading-education community:
a live charting terminal, a real-time community chat, copy/idea tools,
education modules, webinars, and an MT5-connected trading dashboard.

## Tech stack

- **Build:** Vite + React 18 + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives), Framer Motion
- **Charts:** lightweight-charts, Recharts
- **Data/Auth:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Market data & execution:** Trading Layer → MT5, via Supabase edge functions
- **i18n:** custom context (EN / ES / PT-BR)
- **Testing:** Vitest + Testing Library, Playwright

## Getting started

```bash
npm install        # or: bun install
npm run dev        # start the dev server on :8080
```

## Useful scripts

| Script            | Purpose                       |
| ----------------- | ----------------------------- |
| `npm run dev`     | Start the Vite dev server     |
| `npm run build`   | Production build              |
| `npm run lint`    | ESLint                        |
| `npm test`        | Run the Vitest suite          |
| `npm run preview` | Preview the production build  |

## Project layout

- `src/pages/` — route-level pages (Dashboard, LiveChart, Chatroom, Admin, …)
- `src/components/` — feature components (`livechart/`, `chatroom/`, `dashboard/`,
  `terminal/`, `admin/`, `ui/`)
- `src/contexts/`, `src/hooks/`, `src/stores/` — app state and data hooks
- `src/i18n/` — translations and language context
- `supabase/functions/` — edge functions (market data, order execution, AI tools)
- `supabase/migrations/` — database schema and policy migrations

## Deployment

The app is developed in [Lovable](https://lovable.dev) and published from the
`main` branch. The frontend deploys via Lovable; Supabase edge functions and
migrations deploy through the Lovable ↔ Supabase integration.
