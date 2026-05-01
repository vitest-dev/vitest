export interface HTMLOptions {
  /**
   * Path to the generated HTML report.
   *
   * @default 'html/index.html'
   */
  outputFile?: string
  /**
   * Inline report assets, metadata, and attachments into the generated HTML file.
   *
   * Useful for sharing or uploading a portable report as a single file.
   *
   * @default false
   */
  singleFile?: boolean
}
