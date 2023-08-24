/**
 * Happy DOM options.
 */
export interface HappyDOMOptions {
  width?: number
  height?: number
  url?: string
  settings?: {
    disableJavaScriptEvaluation?: boolean
    disableJavaScriptFileLoading?: boolean
    disableCSSFileLoading?: boolean
    disableIframePageLoading?: boolean
    disableComputedStyleRendering?: boolean
    enableFileSystemHttpRequests?: boolean
    device?: {
      prefersColorScheme?: string
      mediaType?: string
    }
  }
}
