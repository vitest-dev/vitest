import { startVitest } from 'vitest/node'

const configs = [
  ['default-css', {}],
  ['process-css', { include: [/App\.css/] }],
  ['process-module', { include: [/App\.module\.css/] }],
  ['scope-module', { include: [/App\.module\.css/], modules: { scopeClassNames: true } }],
]

async function runTests() {
  for (const [name, config] of configs) {
    const success = await startVitest([name], {
      run: true,
      css: config,
      teardownTimeout: 1000_000_000,
    })

    if (!success)
      process.exit(1)
  }

  process.exit(0)
}

runTests()
