# React Admin Template

<div align="center">
  <img src="https://img.shields.io/badge/React-19.1.0-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS" />
</div>

<br />

A production-ready, reusable React + TypeScript admin dashboard template with authentication, data tables, settings, and a modular feature-based architecture.

## Tech Stack

- **React 19** + **TypeScript 5.8** (strict mode)
- **Vite 6** - Build tool with HMR
- **TanStack Router** - File-based routing with code-splitting
- **TanStack Table** - Data tables with sorting, filtering, pagination
- **TanStack Query** - Server state management
- **ShadcnUI** + **Radix UI** - Component library
- **TailwindCSS v4** - Utility-first CSS
- **Zustand** - Global state management
- **React Hook Form** + **Zod** - Form handling with validation
- **axios** - HTTP client with interceptors
- **i18next** - Internationalization
- **Sonner** - Toast notifications

## Features

- Authentication flow (sign-in, sign-up, forgot password, OTP)
- Dashboard with stats cards and activity feed
- Users management (CRUD with data table)
- Tasks management (data table with filters)
- Settings (profile, account, appearance, notifications, display)
- Collapsible sidebar with navigation
- Light/dark theme toggle
- Command palette (Ctrl+K)
- Error pages (401, 403, 404, 500, 503)
- Centralized API layer with typed endpoints
- Environment-based configuration

## Getting Started

```bash
# Clone the repository
git clone <your-repo-url>

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

## Project Structure

```
src/
├── api/              # Centralized API layer (axios, endpoints, types)
├── components/
│   ├── layout/       # Sidebar, header, navigation
│   ├── ui/           # ShadcnUI components
│   └── *.tsx         # Shared components
├── config/           # App configuration, fonts
├── context/          # React contexts (theme, font, search)
├── features/
│   ├── auth/         # Authentication pages
│   ├── dashboard/    # Dashboard overview
│   ├── errors/       # Error pages
│   ├── settings/     # User settings
│   ├── tasks/        # Task management (example)
│   └── users/        # User management (example)
├── hooks/            # Custom React hooks
├── i18n/             # Internationalization
├── lib/              # Utilities (cn helper)
├── routes/           # TanStack Router file-based routes
├── stores/           # Zustand stores
├── styles/           # Design tokens
├── types/            # TypeScript types
└── utils/            # Utility functions
```

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Type-check + production build
pnpm preview          # Preview production build
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
pnpm knip             # Check for unused dependencies
pnpm size             # JavaScript budget: first-load JS < 200 KB gzipped (after pnpm build)
pnpm test:browser     # Playwright offline test (after pnpm build; first: pnpm exec playwright install chromium)
pnpm lighthouse       # Lighthouse CI, mobile profile, installability assertions (after pnpm build)
```

## PWA and offline mode (ADR 0010)

- **Service worker** (`vite-plugin-pwa`, Workbox `generateSW`, configured in `vite.config.ts`): precaches the app shell and every built JS/CSS chunk, so guides and legal pages (bundled Markdown) work offline. API reads (portfolio, securities and prices, sectors, watchlist, `users/me`) are cached network-first; `/api/auth/*` and non-GET requests never are. Registered in production builds only.
- **Updates: prompt.** A new version is downloaded in the background; a toast offers to reload into it. Until accepted, the running version stays (nothing being typed is lost); it takes over once every Doni tab is closed.
- **Persisted query cache**: the TanStack Query cache is saved to IndexedDB (`src/lib/offline/`), kept 7 days, discarded when the app version changes. Sign-out (or an expired session) deletes it, along with the service worker's API cache. Offline after a reload, the last signed-in user's synced data is shown read-only.
- **Offline UI**: `useOnline()` is the single source of truth. A banner shows while offline; pages show when their data was synced (`SyncedAt`); every write uses `OnlineButton`, disabled offline with the reason. There are no offline writes and no queued mutations.
- **Push notifications (#19)** will add their handler to the service worker via `workbox.importScripts`, or by switching to `injectManifest`.
- **Budget**: `scripts/check-bundle-size.mjs` reads the Vite manifest and sums the gzipped entry chunk, its static imports and the landing page's route chunks; CI fails above 200 KB.

## Environment Variables

See `.env.example` for all available variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:3000/api` |
| `VITE_AUTH_TOKEN_KEY` | Cookie key for auth token | `app_access_token` |
| `VITE_APP_NAME` | Application display name | `React Admin Template` |

## Docker

```bash
docker build -t react-admin .
docker run -p 80:80 react-admin
```

## License

MIT
