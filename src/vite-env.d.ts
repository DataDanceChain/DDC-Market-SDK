/// <reference types="vite/client" />

/**
 * Vite environment variable types
 * This allows TypeScript to recognize import.meta.env
 */
interface ImportMetaEnv {
  // You can add specific variables here for better type safety
  readonly API_BASE_URL?: string;
  readonly API_TIMEOUT?: string;
  readonly DEBUG?: string;
  readonly MODE: string;
  // Allow any other environment variables
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
