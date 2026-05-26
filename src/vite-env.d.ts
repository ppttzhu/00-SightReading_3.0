/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CMS_SECRET: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_ENABLE_LOCAL_CMS: string;
  readonly VITE_SERVER_STORAGE_URL: string;
  readonly VITE_STORAGE_PROVIDER: 'supabase' | 'cloudflare' | 'server' | 'local' | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
