/* eslint-disable no-console */
import c from 'picocolors'
import minimist from 'minimist'
import { execaNode } from 'execa'

const ENTRY = './cli.mjs'

// Node errors seen in Vitest (vitejs/vite#9492)
const ERRORS = [
  'Check failed: result.second.', // nodejs/node#43617
  'FATAL ERROR: v8::FromJust Maybe value is Nothing.', // vitest-dev/vitest#1191
]

interface Args {
  args: string[]
  retries: number
}

function parseArgs(): Args {
  const args = minimist(process.argv.slice(2), {
    'string': ['segfault-retry'],
    '--': true,
    'stopEarly': true,
  })

  const showUsageAndExit = (msg: string) => {
    console.error(msg)
    process.exit(1)
  }

  if (args.r && Number.isNaN(Number(args.r)))
    showUsageAndExit(c.red('Invalid <r> value'))

  if (!args._.length)
    showUsageAndExit(c.red('Missing <cmd> argument'))

  return {
    retries: Number(args.r),
    args: args._,
  }
}

function findError(log: string) {
  return log ? ERRORS.find(error => log.includes(error)) ?? '' : ''
}

async function main({ args, retries }: Args) {
  // default exit code = 100, as in retries were exhausted
  let exitCode = 100

  console.log(args)

  for (let i = 0; i < retries; i++) {
    const childProc = execaNode(ENTRY, args, {
      reject: false,
      all: true,
    })
    childProc.all!.pipe(process.stdout)
    const { all: cmdOutput } = await childProc

    const error = findError(cmdOutput ?? '')
    if (error) {
      // use GitHub Action annotation to highlight error
      if (process.env.GITHUB_ACTIONS)
        console.log(`::warning::FLAKE DETECTED: ${error}`)

      console.log(
        `${c.black(c.bgRed(' FLAKE DETECTED: '))
           } ${
           c.red(error)}`,
      )
      console.log(
         `${c.black(c.bgBlue(' RETRYING: '))} ${c.gray(
           `(${i + 1} of ${retries})`,
         )} ${c.blue(args.join(' '))}`,
      )
    }
    else {
      exitCode = childProc.exitCode!
      break
    }
  }
  process.exit(exitCode)
}

main(parseArgs())
