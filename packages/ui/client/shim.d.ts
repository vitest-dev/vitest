/// <reference types="vite/client" />

declare interface Window {
  HTML_REPORT_METADATA?: Promise<Uint8Array>
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_TEST_PATH?: string
}
