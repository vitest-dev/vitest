import type { RollupError } from 'rollup'
import type { LogErrorOptions, Logger, LoggerOptions, LogLevel, LogType } from 'vite'
import type { Logger as VitestLogger } from './logger'
import colors from 'tinyrainbow'

const LogLevels: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
}

function clearScreen(logger: VitestLogger) {
  const repeatCount = process.stdout.rows - 2
  const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : ''
  logger.clearScreen(blank)
}

let lastType: LogType | undefined
let lastMsg: string | undefined
let sameCount = 0

// Only initialize the timeFormatter when the timestamp option is used, and
// reuse it across all loggers
let timeFormatter: Intl.DateTimeFormat
function getTimeFormatter() {
  timeFormatter ??= new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })
  return timeFormatter
}

// This is copy-pasted and needs to be synced from time to time. Ideally, Vite's `createLogger` should accept a custom `console`
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/logger.ts?rgh-link-date=2024-10-16T23%3A29%3A19Z
// When Vitest supports only Vite 6 and above, we can use Vite's `createLogger({ console })`
// https://github.com/vitejs/vite/pull/18379
export function createViteLogger(
  console: VitestLogger,
  level: LogLevel = 'info',
  options: LoggerOptions = {},
): Logger {
  const loggedErrors = new WeakSet<Error | RollupError>()
  const { prefix = '[vite]', allowClearScreen = true } = options
  const thresh = LogLevels[level]
  const canClearScreen
    = allowClearScreen && process.stdout.isTTY && !process.env.CI
  const clear = canClearScreen ? clearScreen : () => {}

  function format(type: LogType, msg: string, options: LogErrorOptions = {}) {
    if (options.timestamp) {
      let tag = ''
      if (type === 'info') {
        tag = colors.cyan(colors.bold(prefix))
      }
      else if (type === 'warn') {
        tag = colors.yellow(colors.bold(prefix))
      }
      else {
        tag = colors.red(colors.bold(prefix))
      }
      const environment = (options as any).environment ? `${(options as any).environment} ` : ''
      return `${colors.dim(getTimeFormatter().format(new Date()))} ${tag} ${environment}${msg}`
    }
    else {
      return msg
    }
  }

  function output(type: LogType, msg: string, options: LogErrorOptions = {}) {
    if (thresh >= LogLevels[type]) {
      const method = type === 'info' ? 'log' : type

      if (options.error) {
        loggedErrors.add(options.error)
      }
      if (canClearScreen) {
        if (type === lastType && msg === lastMsg) {
          sameCount++
          clear(console)
          console[method](
            format(type, msg, options),
            colors.yellow(`(x${sameCount + 1})`),
          )
        }
        else {
          sameCount = 0
          lastMsg = msg
          lastType = type
          if (options.clear) {
            clear(console)
          }
          console[method](format(type, msg, options))
        }
      }
      else {
        console[method](format(type, msg, options))
      }
    }
  }

  const warnedMessages = new Set<string>()

  const logger: Logger = {
    hasWarned: false,
    info(msg, opts) {
      output('info', msg, opts)
    },
    warn(msg, opts) {
      logger.hasWarned = true
      output('warn', msg, opts)
    },
    warnOnce(msg, opts) {
      if (warnedMessages.has(msg)) {
        return
      }
      logger.hasWarned = true
      output('warn', msg, opts)
      warnedMessages.add(msg)
    },
    error(msg, opts) {
      logger.hasWarned = true
      output('error', msg, opts)
    },
    clearScreen(type) {
      if (thresh >= LogLevels[type]) {
        clear(console)
      }
    },
    hasErrorLogged(error) {
      return loggedErrors.has(error)
    },
  }

  return logger
}

// silence warning by Vite for statically not analyzable dynamic import
export function silenceImportViteIgnoreWarning(logger: Logger): Logger {
  return {
    ...logger,
    warn(msg, options) {
      if (msg.includes('The above dynamic import cannot be analyzed by Vite')) {
        return
      }
      logger.warn(msg, options)
    },
  }
}
