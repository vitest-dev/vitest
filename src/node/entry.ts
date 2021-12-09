import { ResolvedConfig } from '../types'
import { run } from '../runtime/run'

if (!process.__vite_node__ || !process.__vitest__)
  throw new Error('Vitest can only run in vite-node environment, please use the CLI to start the process')

const inlineOptions = process.__vite_node__.server.config.test || {}
const cliOptions = process.__vitest__.options || {}

const options: ResolvedConfig = {
  ...cliOptions,
  ...inlineOptions,
}

await run(options)

const timer = setTimeout(() => {
  // TODO: warn user and maybe error out
  process.exit()
}, 500)
timer.unref()
