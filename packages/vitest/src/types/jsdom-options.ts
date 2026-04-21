import type { jsdomTypes } from 'vitest/optional-types.js'

export type JSDOMOptions = ConstructorOptionsOverride & Omit<jsdomTypes.ConstructorOptions, keyof ConstructorOptionsOverride>

interface ConstructorOptionsOverride {
  /**
   * The html content for the test.
   *
   * @default '<!DOCTYPE html>'
   */
  html?: string | ArrayBufferLike
  /**
   * userAgent affects the value read from navigator.userAgent, as well as the User-Agent header sent while fetching subresources.
   *
   * @default `Mozilla/5.0 (${process.platform}) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/${jsdomVersion}`
   */
  userAgent?: string
  /**
   * url sets the value returned by window.location, document.URL, and document.documentURI,
   * and affects things like resolution of relative URLs within the document
   * and the same-origin restrictions and referrer used while fetching subresources.
   *
   * @default 'http://localhost:3000'.
   */
  url?: string
  /**
   * Enable console?
   *
   * @default false
   */
  console?: boolean
  /**
   * jsdom does not have the capability to render visual content, and will act like a headless browser by default.
   * It provides hints to web pages through APIs such as document.hidden that their content is not visible.
   *
   * When the `pretendToBeVisual` option is set to `true`, jsdom will pretend that it is rendering and displaying
   * content.
   *
   * @default true
   */
  pretendToBeVisual?: boolean
  /**
   * Enable CookieJar
   *
   * @default false
   */
  cookieJar?: boolean
  resources?: 'usable'
}
