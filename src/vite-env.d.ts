/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIST_ID: string;
  readonly VITE_GIST_TOKEN: string;
  readonly VITE_GIST_OWNER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
