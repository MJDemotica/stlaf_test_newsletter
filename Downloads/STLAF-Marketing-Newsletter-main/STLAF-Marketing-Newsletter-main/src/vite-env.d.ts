//
// File: vite-env.d.ts
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Declares environment variables typescript types for Vite and client referencing
//

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
