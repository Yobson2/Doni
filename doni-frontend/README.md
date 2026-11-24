# Doni frontend

The Doni web app: a React + TypeScript **progressive web app** for tracking BRVM holdings, mobile-first, in French (default) and English. For the project overview and full local setup, see the [root README](../README.md).

## Tech stack

- **React 19** + **TypeScript 5.8** (strict), **Vite 6**
- **TanStack Router**: file-based routing with automatic code splitting
- **TanStack Query**: server state, persisted to IndexedDB for offline reads
- **openapi-fetch** + **openapi-typescript**: API client typed from the backend's `openapi.json`
- **Tailwind CSS 4**, **shadcn/ui** on **Radix UI**, **Tabler** and **Lucide** icons
- **React Hook Form** + **Zod** for forms, **Zustand** for the in-memory session
- **i18next** (FR/EN), **lightweight-charts**, **Framer Motion**, **Sonner** toasts
- **vite-plugin-pwa** (Workbox) for the service worker
- **Vitest** + Testing Library, **Playwright**, **Lighthouse CI**

## Getting started

From the repository root (one pnpm workspace):

```bash
pnpm install
pnpm --filter doni-frontend dev     # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:3000`, so start the backend first (see [`doni-backend/README.md`](../doni-backend/README.md)). No `.env` is needed in development.

## Environment variables

| Variable             | Default                 | Description                                                                                                    |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`       | _(empty: same origin)_  | API origin for builds where the API is on another domain, e.g. `https://api.example.com`. Read at build time.  |
| `VITE_DEV_API_PROXY` | `http://localhost:3000` | Target of the dev server's `/api` proxy. Read by `vite.config.ts` from the shell environment, not from `.env`. |

`.env.example` also lists `VITE_APP_NAME`; nothing in the app reads it (the app name comes from `src/config/app.ts`).

## Project structure

```text
src/
├── api/              # openapi-fetch client (auth refresh on 401) + generated schema.d.ts
├── components/
│   ├── layout/       # sidebar, header, navigation (admin group shown to admins only)
│   ├── offline/      # offline banner, SyncedAt, OnlineButton
│   ├── legal/        # disclaimer and legal links
│   ├── content/      # Markdown renderer
│   ├── ui/           # shadcn/ui components
│   └── …             # logo, theme/language switches, command menu
├── config/           # app name, fonts
├── content/          # bundled Markdown: guides/, legal/ (fr + en), sgi/ directory data
├── context/          # theme, font, search providers
├── features/
│   ├── landing-page/ # public marketing page
│   ├── auth/         # sign-in, sign-up, session restore
│   ├── portfolio/    # valuation, allocation, returns, dividends, ledger forms
│   ├── securities/   # catalogue, company page, admin catalogue and corporate actions
│   ├── watchlist/
│   ├── bulletins/    # admin review of held BOC days
│   ├── content/      # guides, SGI directory, legal pages
│   ├── settings/     # appearance, account (export, deletion)
│   ├── dashboard/    # placeholder
│   └── errors/       # 401, 403, 404, 500, 503
├── hooks/
├── i18n/             # fr.json (default), en.json
├── lib/              # money formatting, motion, utils; offline/ (service worker, cache persistence)
├── routes/           # file-based routes (see below); routeTree.gen.ts is generated
├── stores/           # authStore (access token, in memory only)
└── test/             # test setup, fake API, render helpers
e2e/                  # Playwright offline test and its mock API
scripts/              # check-bundle-size.mjs
```

### Routes

| Group                    | Paths                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `_public`                | `/`, `/guides`, `/guides/$slug`, `/sgi`, `/disclaimer`, `/privacy`                                               |
| `(auth)`                 | `/sign-in`, `/sign-up`, `/forgot-password` (placeholder: no reset API yet)                                       |
| `_authenticated`         | `/dashboard`, `/portfolio`, `/securities`, `/securities/$ticker`, `/watchlist`, `/settings`, `/settings/account` |
| `_authenticated` (admin) | `/admin/catalogue`, `/admin/bulletins`                                                                           |
| `(errors)`               | `/401`, `/403`, `/404`, `/500`, `/503`                                                                           |

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Type-check + production build
pnpm preview          # Preview production build
pnpm lint             # Run ESLint
pnpm typecheck        # TypeScript, no emit
pnpm test             # Unit and component tests (Vitest)
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
pnpm knip             # Check for unused files, exports and dependencies
pnpm api:generate     # Regenerate src/api/schema.d.ts from ../doni-backend/openapi.json
pnpm size             # JavaScript budget: first-load JS < 200 KB gzipped (after pnpm build)
pnpm test:browser     # Playwright offline test (after pnpm build; first: pnpm exec playwright install chromium)
pnpm lighthouse       # Lighthouse CI, mobile profile, installability assertions (after pnpm build)
```

## API client and session

- `src/api/schema.d.ts` is generated; never edit it by hand. After a backend API change: `pnpm --filter doni-backend openapi:emit`, then `pnpm api:generate`.
- The access token lives only in memory (`stores/authStore.ts`). On load, and when a request gets a `401`, the client calls `/api/auth/refresh`, which uses the `HttpOnly` refresh cookie, and retries.
- Requests are sent with `credentials: 'include'`. Since the cookie is `SameSite=Strict`, the app and the API must be on the same site in production (see [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md#same-site-requirement-for-the-session-cookie)).

## Internationalisation (ADR 0012)

French is the default; the choice is saved in `localStorage` (`doni-lang`). Every visible string goes through i18next, with keys in both `fr.json` and `en.json`; `eslint-plugin-i18next` flags literal strings. Guides and legal pages exist as Markdown in both languages under `src/content/`.

## PWA and offline mode (ADR 0010)

- **Service worker** (`vite-plugin-pwa`, Workbox `generateSW`, configured in `vite.config.ts`): precaches the app shell and every built JS/CSS chunk, so guides and legal pages (bundled Markdown) work offline. API reads (portfolio, securities and prices, sectors, watchlist, `users/me`) are cached network-first; `/api/auth/*` and non-GET requests never are. Registered in production builds only.
- **Updates: prompt.** A new version is downloaded in the background; a toast offers to reload into it. Until accepted, the running version stays (nothing being typed is lost); it takes over once every Doni tab is closed.
- **Persisted query cache**: the TanStack Query cache is saved to IndexedDB (`src/lib/offline/`), kept 7 days, discarded when the app version changes. Sign-out (or an expired session) deletes it, along with the service worker's API cache. Offline after a reload, the last signed-in user's synced data is shown read-only.
- **Offline UI**: `useOnline()` is the single source of truth. A banner shows while offline; pages show when their data was synced (`SyncedAt`); every write uses `OnlineButton`, disabled offline with the reason. There are no offline writes and no queued mutations.
- **Push notifications (#19)** will add their handler to the service worker via `workbox.importScripts`, or by switching to `injectManifest`.
- **Budget**: `scripts/check-bundle-size.mjs` reads the Vite manifest and sums the gzipped entry chunk, its static imports and the landing page's route chunks; CI fails above 200 KB.

## Brand

The logo, colours and icon set are described in [`docs/brand/logo.md`](../docs/brand/logo.md); the SVG masters are in `public/images/brand/`.

## Deployment

The frontend is a static build (`dist/`). `vercel.json` configures Vercel (SPA rewrites to `index.html`). See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md), including the caveat that the `Dockerfile` in this folder does not build inside the pnpm workspace as written.
