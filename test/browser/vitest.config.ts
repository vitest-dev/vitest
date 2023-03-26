import { defineConfig } from 'vitest/config'

const noop = () => {}
const isPlaywright = !!process.env.PLAYWRIGHT

export default defineConfig({
  test: {
    include: ['test/**.test.{ts,js}'],
    browser: {
      enabled: true,
      name: 'chrome',
      headless: true,
      provider: isPlaywright ? 'playwright' : 'webdriverio',
    },
    open: false,
    isolate: false,
    outputFile: './browser.json',
    reporters: ['json', {
      onInit: noop,
      onPathsCollected: noop,
      onCollected: noop,
      onFinished: noop,
      onTaskUpdate: noop,
      onTestRemoved: noop,
      onWatcherStart: noop,
      onWatcherRerun: noop,
      onServerRestart: noop,
      onUserConsoleLog: noop,
    }, 'default'],
  },
})
