// The two frontend settings, typed so nothing reads them as `any`.
interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string; // "1" uses the built-in fake API
  readonly VITE_API_BASE?: string; // only for a deployed build
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
