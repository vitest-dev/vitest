import { readFile } from 'fs/promises'
import { execa } from 'execa'

let error
await execa('npx', ['vitest', 'bench', 'base.bench', 'mode.bench'], {
  env: {
    ...process.env,
    CI: 'true',
    NO_COLOR: 'true',
  },
})
  .catch((e) => {
    error = e
  })

const benchResult = await readFile('./bench.json', 'utf-8')

if (benchResult.includes('skip'))
  process.exit(1)

if (error) {
  console.error(error)
  process.exit(1)
}

process.exit(0)
