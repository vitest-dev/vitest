import { run } from '../runtime/run'

if (!process.__vitest__)
  throw new Error('Vitest can only run in vite-node environment, please use the CLI to start the process')

await run(process.__vitest__.config)

const timer = setTimeout(() => {
  // TODO: warn user and maybe error out
  process.exit()
}, 500)
timer.unref()
