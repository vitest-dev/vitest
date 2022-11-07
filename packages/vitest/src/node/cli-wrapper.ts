/* eslint-disable no-console */
/**
 * Wrapper of the CLI with child process to manage segfaults and retries.
 */
import { fileURLToPath } from 'url'
import c from 'picocolors'
import { execa } from 'execa'
import { EXIT_CODE_RESTART } from '../constants'

const ENTRY = new URL('./cli.js', import.meta.url)

/** Arguments passed to Node before the script */
const NODE_ARGS = [
  '--inspect',
  '--inspect-brk',
  '--trace-deprecation',
  '--experimental-wasm-threads',
  '--wasm-atomics-on-non-shared-memory',
]

interface ErrorDef {
  trigger: string
  url: string
}

const SegfaultErrors: ErrorDef[] = [
  {
    trigger: 'Check failed: result.second.',
    url: 'https://github.com/nodejs/node/issues/43617',
  },
  {
    trigger: 'FATAL ERROR: v8::FromJust Maybe value is Nothing.',
    url: 'https://github.com/vitest-dev/vitest/issues/1191',
  },
  {
    trigger: 'FATAL ERROR: v8::ToLocalChecked Empty MaybeLocal.',
    url: 'https://github.com/nodejs/node/issues/42407',
  },
]

main()

async function main() {
  // default exit code = 100, as in retries were exhausted
  let retries = 0
  const args = process.argv.slice(2)

  if (process.env.VITEST_SEGFAULT_RETRY) {
    retries = +process.env.VITEST_SEGFAULT_RETRY
  }
  else {
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--segfault-retry=')) {
        retries = +args[i].split('=')[1]
        break
      }
      else if (args[i] === '--segfault-retry' && args[i + 1]?.match(/^\d+$/)) {
        retries = +args[i + 1]
        break
      }
    }
  }

  // if not specified, don't run through spawn,
  // because it prints stderr messages in the wrong order compared to stdout
  if (retries <= 0) {
    await import('./cli')
    return
  }

  const nodeArgs: string[] = []
  const vitestArgs: string[] = []

  // move node args to the front
  for (let i = 0; i < args.length; i++) {
    let matched = false
    for (const nodeArg of NODE_ARGS) {
      if (args[i] === nodeArg || args[i].startsWith(`${nodeArg}=`)) {
        matched = true
        nodeArgs.push(args[i])
        break
      }
    }
    if (!matched)
      vitestArgs.push(args[i])
  }

  retries = Math.max(1, retries || 1)

  for (let i = 1; i <= retries; i++) {
    const result = await start(nodeArgs, vitestArgs)

    if (result === 'restart') {
      i -= 1
      continue
    }

    if (i === 1 && retries === 1) {
      console.log(c.yellow(`It seems to be an upstream bug of Node.js. To improve the test stability,
you could pass ${c.bold(c.green('--segfault-retry=3'))} or set env ${c.bold(c.green('VITEST_SEGFAULT_RETRY=3'))} to
have Vitest auto retries on flaky segfaults.\n`))
    }

    if (i !== retries)
      console.log(`${c.inverse(c.bold(c.magenta(' Retrying ')))} vitest ${args.join(' ')} ${c.gray(`(${i + 1} of ${retries})`)}`)
  }

  // retry out
  process.exit(1)
}

async function start(preArgs: string[], postArgs: string[]) {
  const child = execa(
    'node',
    [
      ...preArgs,
      fileURLToPath(ENTRY),
      ...postArgs,
    ],
    {
      reject: false,
      stderr: 'pipe',
      stdout: 'inherit',
      stdin: 'inherit',
      env: {
        ...process.env,
        VITEST_CLI_WRAPPER: 'true',
      },
    },
  )
  child.stderr?.pipe(process.stderr)
  const { stderr = '' } = await child

  if (child.exitCode === EXIT_CODE_RESTART)
    return 'restart'

  for (const error of SegfaultErrors) {
    if (stderr.includes(error.trigger)) {
      if (process.env.GITHUB_ACTIONS)
        console.log(`::warning:: Segmentfault Error Detected: ${error.trigger}\nRefer to ${error.url}`)
      const RED_BLOCK = c.inverse(c.red(' '))
      console.log(`\n${c.inverse(c.bold(c.red(' Segmentfault Error Detected ')))}\n${RED_BLOCK} ${c.red(error.trigger)}\n${RED_BLOCK} ${c.red(`Refer to ${error.url}`)}\n`)
      return 'error'
    }
  }

  // no segmentfault found
  process.exit(child.exitCode!)
}

