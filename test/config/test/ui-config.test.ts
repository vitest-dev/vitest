import { expect, test } from 'vitest'
import { createVitest } from 'vitest/node'

test('ui: true resolves to enabled config', async () => {
  const vitest = await createVitest('test', {
    ui: true,
  })

  expect(vitest.config.ui).toEqual({
    enabled: true,
    screenshotsInReport: false,
    cleanupScreenshots: false,
  })

  await vitest.close()
})

test('ui: false resolves to disabled config', async () => {
  const vitest = await createVitest('test', {
    ui: false,
  })

  expect(vitest.config.ui).toEqual({
    enabled: false,
    screenshotsInReport: false,
    cleanupScreenshots: false,
  })

  await vitest.close()
})

test('ui: { enabled: true } works', async () => {
  const vitest = await createVitest('test', {
    ui: { enabled: true },
  })

  expect(vitest.config.ui).toEqual({
    enabled: true,
    screenshotsInReport: false,
    cleanupScreenshots: false,
  })

  await vitest.close()
})

test('ui: { screenshotsInReport: true } does not implicitly enable UI', async () => {
  const vitest = await createVitest('test', {
    ui: { screenshotsInReport: true },
  })

  expect(vitest.config.ui).toEqual({
    enabled: false,
    screenshotsInReport: true,
    cleanupScreenshots: false,
  })

  await vitest.close()
})

test('ui: { enabled: true, screenshotsInReport: true } enables both', async () => {
  const vitest = await createVitest('test', {
    ui: {
      enabled: true,
      screenshotsInReport: true,
    },
  })

  expect(vitest.config.ui).toEqual({
    enabled: true,
    screenshotsInReport: true,
    cleanupScreenshots: false,
  })

  await vitest.close()
})

test('ui: { cleanupScreenshots: true } works', async () => {
  const vitest = await createVitest('test', {
    ui: { cleanupScreenshots: true },
  })

  expect(vitest.config.ui).toEqual({
    enabled: false,
    screenshotsInReport: false,
    cleanupScreenshots: true,
  })

  await vitest.close()
})

test('ui: undefined defaults to disabled config', async () => {
  const vitest = await createVitest('test', {})

  expect(vitest.config.ui).toEqual({
    enabled: false,
    screenshotsInReport: false,
    cleanupScreenshots: false,
  })

  await vitest.close()
})
