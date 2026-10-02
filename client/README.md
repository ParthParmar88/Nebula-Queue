# Nebula Queue — client

React 19 + Vite + Tailwind CSS. Run it with `npm run dev` (see the root README for the full stack).

## Structure

```text
src/
├── api/            HTTP calls (axios) and error-message helpers
├── components/
│   ├── ui/         Design-system primitives: Button, Field/Input, Dialog, DropdownMenu,
│   │               Tabs, Tooltip, Alert, Badge, Skeleton, EmptyState, Pagination…
│   ├── layout/     App shell: sidebar, mobile nav, user menu, connection status
│   └── jobs/       Job-specific pieces: table, New job dialog, cancel dialog, timeline
├── context/        Auth, theme, toasts, shell (React context + providers)
├── hooks/          Data (useJobs), live updates (useJobSocket), modal/hotkey/clock helpers
├── lib/            Router, formatting, job-type metadata, `cn()` class helper
└── pages/          Overview, Jobs, Job detail, Sign in, Not found
```

## Routes

Hash-based, so the app works on any static host without rewrites:

| Path | Page |
| --- | --- |
| `#/` | Overview — counts, recent jobs, breakdown by type |
| `#/jobs?status=&q=&page=&size=` | Jobs — filter, search and pagination live in the URL |
| `#/jobs/:id` | Job detail — status, lifecycle, payload, result |

## Data flow

- **React Query** owns server state. `useJobsQuery` / `useJobQuery` load over REST.
- **WebSocket** (STOMP over SockJS) messages carry the full job; `useApplyJobUpdate` merges
  them into the same cache, keeping whichever copy has the newer `updatedAt`. Every page
  updates live from one source.
- Mutations (`useSubmitJob`, `useCancelJob`) write their responses into the cache the same way.

## Design system

- **Tokens** are CSS variables in `src/index.css` (light + dark), exposed as Tailwind colors in
  `tailwind.config.js`: `bg`, `surface`, `border`, `fg`, `accent`, and `success` / `warning` /
  `danger` / `info`. Use these — not Tailwind palette colors — so both themes stay correct.
- **Type:** Inter for UI, JetBrains Mono for IDs and code. Sizes: `text-2xs`, `text-xs`,
  `text-13` (dense UI), `text-sm` (body), `text-xl`/`2xl` (page titles).
- **Radius:** `rounded-md` for controls, `rounded-lg` for cards and dialogs, `rounded-full` for dots/avatars.
- **Variants** for buttons, fields and badges live in `components/ui/variants.js`.
- Theme follows the OS by default; users can pin light/dark from the account menu.

## Keyboard

| Key | Action |
| --- | --- |
| `N` | New job (anywhere) |
| `/` | Focus search on the Jobs page |
| `Ctrl`/`⌘` + `Enter` | Submit the New job form |
| `Esc` | Close dialogs and menus; clear search |
