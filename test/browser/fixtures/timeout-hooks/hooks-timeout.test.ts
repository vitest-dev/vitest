import { page, server } from 'vitest/browser';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFailed, onTestFinished } from 'vitest';

describe.runIf(server.provider === 'playwright')('timeouts are failing correctly', () => {
  it('click on non-existing element fails', async () => {
    await page.getByRole('code').click()
  }, 150)

  it('expect.element on non-existing element fails', async () => {
    await expect.element(page.getByRole('code')).toBeVisible()
  }, 150)

  describe('beforeEach', () => {
    beforeEach(async () => {
      await page.getByTestId('non-existing').click()
    }, 150)

    it('skipped', () => {})
  })

  describe('afterEach', () => {
    afterEach(async () => {
      await page.getByTestId('non-existing').click()
    }, 150)

    it('skipped', () => {})
  })

  describe('beforeAll', () => {
    beforeAll(async () => {
      await page.getByTestId('non-existing').click()
    }, 150)

    it('skipped', () => {})
  })

  describe('afterAll', () => {
    afterAll(async () => {
      await page.getByTestId('non-existing').click()
    }, 150)

    it('skipped', () => {})
  })

  describe('onTestFinished', () => {
    it('fails', ({ onTestFinished }) => {
      onTestFinished(async () => {
        await page.getByTestId('non-existing').click()
      }, 150)
    })

    it('fails global', () => {
      onTestFinished(async () => {
        await page.getByTestId('non-existing').click()
      }, 150)
    })
  })

  describe('onTestFailed', () => {
    it('fails', ({ onTestFailed }) => {
      onTestFailed(async () => {
        await page.getByTestId('non-existing').click()
      }, 150)

      expect.unreachable()
    })

    it('fails global', () => {
      onTestFailed(async () => {
        await page.getByTestId('non-existing').click()
      }, 150)

      expect.unreachable()
    })
  })
})
