/// <reference types="vite/client" />

declare interface Window {
  HTML_REPORT_METADATA?: Promise<Uint8Array>
  // renders every explorer row and editor line, used by e2e tests
  VITEST_UI_DISABLE_VIRTUALIZATION?: boolean
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_TEST_PATH?: string
}
