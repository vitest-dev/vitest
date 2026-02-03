import { afterAll, beforeAll, expect, test } from 'vitest'

import { usersData } from '../mockData'
import { createServer } from '../src/app'

let baseUrl = ''
let server: ReturnType<typeof createServer>

beforeAll(async () => {
  server = createServer()

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine server port'))
        return
      }

      baseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }

      resolve()
    })
  })
})

test('returns the users list', async () => {
  const response = await fetch(`${baseUrl}/users`)

  expect(response.status).toBe(200)

  const data = await response.json()

  expect(data).toHaveLength(4)
  expect(data).toStrictEqual(usersData)
})
