import sinon from 'sinon'

export * from './types'
export * from './suite'
export * from './config'
export * from './chai'

export { beforeAll, afterAll, beforeEach, afterEach, beforeFile, afterFile, beforeSuite, afterSuite } from './hooks'

export { sinon }
export const { mock, spy } = sinon
