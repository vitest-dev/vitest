import supertest from 'supertest'
import { afterAll, expect, test } from 'vitest'

import { usersData } from '../mockData'
import app from '../src/app'

test('with HTTP injection', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/users',
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.payload)).toHaveLength(4)
  expect(JSON.parse(response.payload)).toStrictEqual(usersData)
})

test('with a running server', async () => {
  await app.ready()

  const response = await supertest(app.server)
    .get('/users')
    .expect(200)

  expect(response.body).toHaveLength(4)
  expect(response.body).toStrictEqual(usersData)
})

test('with axios', async () => {
  await app.listen()
  await app.ready()

  const address = app.server.address()
  const port = typeof address === 'string' ? address : address?.port

  const response = await fetch(`http://localhost:${port}/users`).then(r => r.json())

  expect(response).toHaveLength(4)
  expect(response).toStrictEqual(usersData)
})

afterAll(async () => {
  await app.close()
})
