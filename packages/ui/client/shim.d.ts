/// <reference types="vite/client" />

declare interface Window {
  METADATA_PATH?: string
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_TEST_PATH?: string
}
