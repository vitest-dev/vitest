import { test as baseTest, expect } from 'vitest'
import { usersData } from '../mockData.js'
import { app } from '../src/app.ts'

const test = baseTest.extend('request', { scope: 'file' }, async ({}, ctx) => {
  const baseURL = await new Promise<string>((resolve, reject) => {
    app.once('error', reject)
    app.listen(() => {
      const address = app.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine server port'))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })

  ctx.onCleanup(async () => {
    await new Promise<void>((resolve, reject) => {
      app.close(err => err ? reject(err) : resolve())
    })
  })

  return {
    baseURL,
    get: (url: string) => fetch(new URL(url, baseURL)),
  }
})

test('/users', async ({ request }) => {
  const response = await request.get('/users')
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data).toStrictEqual(usersData)
})

test('not found', async ({ request }) => {
  const response = await request.get('/asdf')
  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not found')
})
