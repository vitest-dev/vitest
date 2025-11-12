import { afterEach, expect, it } from 'vitest'
import { page } from 'vitest/browser'

afterEach(async () => {
  await page.unrouteAll()
})

it('fulfills intercepted requests', async () => {
  await page.route(/\/api\/route-fulfill$/, (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'stubbed' }),
    })
  })

  const response = await fetch('/api/route-fulfill')
  expect(response.status).toBe(201)
  const data = await response.json()
  expect(data).toEqual({ message: 'stubbed' })
})

it('aborts intercepted requests', async () => {
  await page.route(/\/api\/route-abort$/, (route) => {
    route.abort()
  })

  await expect(fetch('/api/route-abort')).rejects.toBeInstanceOf(Error)
})
