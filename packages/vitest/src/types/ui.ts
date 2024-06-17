export interface BrowserUI {
  setCurrentFileId: (fileId: string) => void
  setIframeViewport: (width: number, height: number) => Promise<void>
}
