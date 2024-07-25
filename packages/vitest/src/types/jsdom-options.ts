export interface JSDOMOptions {
  /**
   * The html content for the test.
   *
   * @default '<!DOCTYPE html>'
   */
  html?: string | ArrayBufferLike
  /**
   * referrer just affects the value read from document.referrer.
   * It defaults to no referrer (which reflects as the empty string).
   */
  referrer?: string
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
   * contentType affects the value read from document.contentType, and how the document is parsed: as HTML or as XML.
   * Values that are not "text/html" or an XML mime type will throw.
   *
   * @default 'text/html'.
   */
  contentType?: string
  /**
   * The maximum size in code units for the separate storage areas used by localStorage and sessionStorage.
   * Attempts to store data larger than this limit will cause a DOMException to be thrown. By default, it is set
   * to 5,000,000 code units per origin, as inspired by the HTML specification.
   *
   * @default 5_000_000
   */
  storageQuota?: number
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
   * `includeNodeLocations` preserves the location info produced by the HTML parser,
   * allowing you to retrieve it with the nodeLocation() method (described below).
   *
   * It defaults to false to give the best performance,
   * and cannot be used with an XML content type since our XML parser does not support location info.
   *
   * @default false
   */
  includeNodeLocations?: boolean | undefined
  /**
   * @default 'dangerously'
   */
  runScripts?: 'dangerously' | 'outside-only'
  /**
   * Enable CookieJar
   *
   * @default false
   */
  cookieJar?: boolean
  resources?: 'usable'
}
