// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], cwd: () => '/', stdout: { write: () => {} }, nextTick: cb => cb() }
globalThis.global = globalThis
async function runTest(test: string) {
  console.log(test)
}

// todo: add logic to run the test, maybe we need broadcastchannel to await execution from main.ts

globalThis.runTest = runTest
