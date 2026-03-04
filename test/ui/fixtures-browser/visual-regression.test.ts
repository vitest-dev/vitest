import { test } from 'vitest'
import { server } from 'vitest/browser'

test('visual regression test', async ({ expect, onTestFinished }) => {
  const screenshotName = 'visual-regression-screenshot.png'

  onTestFinished(async () => {
    if (server.config.snapshotOptions.updateSnapshot !== 'none') {
      await server.commands.removeFile(`fixtures-browser/${screenshotName}`)
    }
  })

  await expect(expect(document.body).toMatchScreenshot(screenshotName)).rejects.toThrow(
    'No existing reference screenshot found',
  )
})
