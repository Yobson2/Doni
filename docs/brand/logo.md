# Doni logo

**Concept: "doni doni" (little by little).** *Doni* means "a little" in Bambara and Dioula. The symbol is a lowercase **d**: a coin-like bowl and a stem that grows to an ochre block, the latest contribution on top. The wordmark draws "doni" from the same parts (ring, 8-unit stem, block). Never set it in a typeface.

## Files

| Use | File |
|---|---|
| React | `doni-frontend/src/components/logo.tsx`: `Logo`, `LogoSmall`, `Wordmark` (body = `currentColor`, top block = `--highlight`) |
| Masters (SVG) | `doni-frontend/public/images/brand/`: symbol, symbol-small, wordmark (colour, black, white, reversed, dark), stacked |
| Favicon | `public/images/favicon.svg` (indigo tile), `favicon_light.svg` (ivory tile for dark browser chrome), `favicon.png` 32px |
| PWA / OS | `public/images/icons/`: `icon-192/512` (rounded), `icon-maskable-192/512` (full bleed, 66% safe zone), `apple-touch-icon` 180 |
| Social | `public/images/og-image.png` 1200×630 |

## Rules

- **Grid:** 64 units. 8-unit stroke everywhere, bowl r12, ascender 6, x-height 26, baseline 58.
- **Colour:** indigo `#2B3990` with ochre `#C98A1E` top block. Ochre appears only on that block. Dark UI: `#ECEDF5` + `#E2A846`. One-colour versions use ink `#1B1D2E` or white.
- **Clear space:** 8 units (one block) on every side.
- **Minimum size:** full symbol 24px. Below that use the small cut (`Logo small` / `LogoSmall`), which has a wider gap. Wordmark 64px wide minimum.
- **Don't:** recolour parts, add gradients or outlines, rotate, or stretch.

## Open items

- Confirm the meaning and spelling of "doni doni" with Bambara and Dioula speakers before using it in copy.
- 5-second recall test with target users.
- Trademark search for "Doni" (OAPI) before launch.
- Set an absolute `og:image` URL in `index.html` once the production domain is known.
- Regenerate PNGs after any geometry change. They were rendered from the SVG masters with headless Chrome.
