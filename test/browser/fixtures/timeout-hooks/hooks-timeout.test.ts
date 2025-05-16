import { page, server } from '@vitest/browser/context';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFailed, onTestFinished } from 'vitest';

describe.runIf(server.provider === 'playwright')('timeouts are failing correctly', () => {
  it('click on non-existing element fails', async () => {
    await new Promise(r => setTimeout(r, 100))
    await page.getByRole('code').click()
  }, 500)

  it('expect.element on non-existing element fails', async () => {
    await expect.element(page.getByRole('code')).toBeVisible()
  }, 500)

  describe('beforeEach', () => {
    beforeEach(async () => {
      await new Promise(r => setTimeout(r, 100))
      await page.getByTestId('non-existing').click()
    }, 500)

    it('skipped')
  })

  describe('afterEach', () => {
    afterEach(async () => {
      await new Promise(r => setTimeout(r, 100))
      await page.getByTestId('non-existing').click()
    }, 500)

    it('skipped')
  })

  describe('beforeAll', () => {
    beforeAll(async () => {
      await new Promise(r => setTimeout(r, 100))
      await page.getByTestId('non-existing').click()
    }, 500)

    it('skipped')
  })

  describe('afterAll', () => {
    afterAll(async () => {
      await new Promise(r => setTimeout(r, 100))
      await page.getByTestId('non-existing').click()
    }, 500)

    it('skipped')
  })

  describe('onTestFinished', () => {
    it('fails', ({ onTestFinished }) => {
      onTestFinished(async () => {
        await new Promise(r => setTimeout(r, 100))
        await page.getByTestId('non-existing').click()
      }, 500)
    })

    it('fails global', () => {
      onTestFinished(async () => {
        await new Promise(r => setTimeout(r, 100))
        await page.getByTestId('non-existing').click()
      }, 500)
    })
  })

  describe('onTestFailed', () => {
    it('fails', ({ onTestFailed }) => {
      onTestFailed(async () => {
        await new Promise(r => setTimeout(r, 100))
        await page.getByTestId('non-existing').click()
      }, 500)

      expect.unreachable()
    })

    it('fails global', () => {
      onTestFailed(async () => {
        await new Promise(r => setTimeout(r, 100))
        await page.getByTestId('non-existing').click()
      }, 500)

      expect.unreachable()
    })
  })
})
