import { afterAll, afterEach, beforeAll } from 'vitest'
import { client } from './ApolloClient'
import { server } from './mocks/server'

beforeAll(() => { server.listen() })

beforeEach(() => { return client.clearStore() })

afterEach(() => { server.resetHandlers() })

afterAll(() => { server.close() })
