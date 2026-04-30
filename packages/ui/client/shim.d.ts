/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

const __BASE_PATH__: string

declare interface Window {
  HTML_REPORT_METADATA?: Promise<Uint8Array>
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_TEST_PATH?: string
}
