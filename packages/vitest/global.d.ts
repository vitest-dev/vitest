declare global {
  const suite: typeof import('vitest')['suite']
  const test: typeof import('vitest')['test']
  const describe: typeof import('vitest')['describe']
  const it: typeof import('vitest')['it']
  const expect: typeof import('vitest')['expect']
  const assert: typeof import('vitest')['assert']
  const sinon: typeof import('vitest')['sinon']
  const spy: typeof import('vitest')['spy']
  const mock: typeof import('vitest')['mock']
  const stub: typeof import('vitest')['stub']
  const beforeAll: typeof import('vitest')['beforeAll']
  const afterAll: typeof import('vitest')['afterAll']
  const beforeEach: typeof import('vitest')['beforeEach']
  const afterEach: typeof import('vitest')['afterEach']
}
export {}
