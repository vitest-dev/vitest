/// <reference types="vite/client" />
/// <reference types="vite-plugin-pages/client" />

declare const __BASE_PATH__: string

declare interface Window {
  METADATA_PATH?: string
}

declare interface Error {
  VITEST_TEST_NAME?: string
  VITEST_AFTER_ENV_TEARDOWN?: boolean
  VITEST_TEST_PATH?: string
}

declare module "*.vue" {
  import { DefineComponent } from "vue"
  const component: DefineComponent<{}, {}, any>
  export default component
}
