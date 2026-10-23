/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_DEMO_DATA?: string;
  readonly VITE_DEMO_COORDINATOR_EMAIL?: string;
  readonly VITE_DEMO_COORDINATOR_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
