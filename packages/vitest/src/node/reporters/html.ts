export interface HTMLOptions {
  /**
   * Directory used as the report artifact root.
   *
   * The report entry is written to `<outputDir>/index.html` and the UI
   * implementation files live under `<outputDir>/ui/`. By default this is the
   * shared `.vitest` artifact directory.
   *
   * @default '.vitest'
   */
  outputDir?: string
  /**
   * Inline report assets, metadata, and attachments into the generated HTML file.
   *
   * @default false
   */
  singleFile?: boolean
}
