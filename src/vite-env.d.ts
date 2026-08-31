/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  readonly VITE_NEON_JWKS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
