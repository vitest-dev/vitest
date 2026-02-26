import { test as baseTest, expect } from 'vitest'
import { page, server } from 'vitest/browser'

const httpMethods = [
  { method: 'GET' as const, url: '/api/route-get', status: 200, body: { message: 'getted' } },
  { method: 'POST' as const, url: '/api/route-post', status: 201, body: { message: 'posted' } },
  { method: 'PUT' as const, url: '/api/route-put', status: 200, body: { message: 'updated' } },
  { method: 'PATCH' as const, url: '/api/route-patch', status: 200, body: { message: 'patched' } },
  { method: 'DELETE' as const, url: '/api/route-delete', status: 200, body: { ok: true } },
] as const

const skipWebdriver = server.provider === 'webdriverio'
const test = baseTest.runIf(!skipWebdriver)

test.each(httpMethods)('fulfills mocked %s request', async (entry) => {
  const { method, url, body, status } = entry
  const methodName = method.toLowerCase() as Lowercase<typeof method>

  await page.http[methodName](url, () => {
    const serializedBody = body ? JSON.stringify(body) : null
    return new Response(serializedBody, {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  const response = await fetch(url, { method })
  expect(response.status).toBe(status)

  expect(await response.json()).toEqual(body)
})

test('fulfills mocked HEAD request', async () => {
  await page.http.head('/api/route-head', () => {
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Length': '1234',
      },
    })
  })

  const response = await fetch('/api/route-head', { method: 'HEAD' })
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Length')).toBe('1234')
})

test('fulfills mocked OPTIONS request', async () => {
  await page.http.options('/api/route-options', () => {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET, POST, OPTIONS',
      },
    })
  })

  const response = await fetch('/api/route-options', { method: 'OPTIONS' })
  expect(response.status).toBe(204)
  expect(response.headers.get('Allow')).toBe('GET, POST, OPTIONS')
})

test('fulfills mocked request with wildcard path', async () => {
  await page.http.get('/api/products/*', () => {
    return new Response(JSON.stringify({ wildcard: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const simple = await fetch('/api/products/123')
  expect(simple.status).toBe(200)
  expect(await simple.json()).toEqual({ wildcard: true })
})

test('fulfills mocked request with RegExp path', async () => {
  await page.http.get(/\/api\/files\/(\d+)$/, () => {
    return new Response(JSON.stringify({ matched: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const simple = await fetch('/api/files/123')
  expect(simple.status).toBe(200)
  expect(await simple.json()).toEqual({ matched: true })
})

test('does not match similar paths', async () => {
  await page.http.get('/api/users', () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  await page.http.get('/api/users/1', () => {
    return new Response(JSON.stringify({ id: 1, name: 'User 1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const exact = await fetch('/api/users')
  expect(exact.status).toBe(200)
  expect(await exact.json()).toEqual({ ok: true })

  const nested = await fetch('/api/users/1')
  expect(nested.status).toBe(200)
  expect(await nested.json()).toEqual({ id: 1, name: 'User 1' })
})
