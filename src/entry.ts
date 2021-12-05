import { run } from './run'

if (!process.__vite_node__ || !process.__vitest__)
  throw new Error('Vite can only run in Vite environment, please use the CLI to start the process')

const inlineOptions = process.__vite_node__.server.config.test || {}
const cliOptions = process.__vitest__.options || {}

await run({
  ...inlineOptions,
  ...cliOptions,
})
