/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

/** The app's version (package.json), set at build time. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** API origin, e.g. https://api.example.com. Unset: same origin. */
  readonly VITE_API_URL?: string
  readonly VITE_APP_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
