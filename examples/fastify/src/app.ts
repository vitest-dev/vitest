import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import {usersData} from '../mockData'

const app: FastifyInstance = Fastify({})

app.get('/users', async () => {
  return usersData
})

export default app
