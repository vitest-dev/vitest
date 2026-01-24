/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

const __BASE_PATH__: string

declare interface Window {
  METADATA_PATH?: string
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_TEST_PATH?: string
}
