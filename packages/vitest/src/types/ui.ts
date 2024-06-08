export interface BrowserUI {
  runTestsFinish: () => void
  setCurrentFileId: (fileId: string) => void
  setIframeViewport: (width: number, height: number) => Promise<void>
}
