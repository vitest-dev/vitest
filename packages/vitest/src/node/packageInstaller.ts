import url, { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { existsSync, realpathSync } from 'node:fs'
import c from 'picocolors'
import { moduleResolve } from 'import-meta-resolve'
import { isAbsolute } from 'pathe'
import { EXIT_CODE_RESTART } from '../constants'
import { isCI } from '../utils/env'
import { slash } from '../utils/base'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const DEFAULT_ROOT_URL = pathToFileURL(process.cwd())
const DEFAULT_CONDITIONS_SET = new Set(['node', 'import'])
const DEFAULT_EXTENSIONS = ['.mjs', '.cjs', '.js', '.json']
const NOT_FOUND_ERRORS = new Set([
  'ERR_MODULE_NOT_FOUND',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'MODULE_NOT_FOUND',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
])

function _tryModuleResolve(id: string, url: URL, conditions: Set<string>) {
  try {
    return moduleResolve(id, url, conditions)
  }
  catch (error: any) {
    if (!NOT_FOUND_ERRORS.has(error.code))
      throw error
  }
}

const TRAILING_SLASH_RE = /\/$|\/\?/
const JOIN_LEADING_SLASH_RE = /^\.?\//
function hasTrailingSlash(input = '', queryParameters = false) {
  if (!queryParameters)
    return input.endsWith('/')
  return TRAILING_SLASH_RE.test(input)
}

function withTrailingSlash(input = '', queryParameters = false) {
  if (!queryParameters)
    return input.endsWith('/') ? input : `${input}/`

  if (hasTrailingSlash(input, true))
    return input || '/'

  const [s0, ...s] = input.split('?')
  return `${s0}/${s.length > 0 ? `?${s.join('?')}` : ''}`
}

function isNonEmptyURL(url: string) {
  return url && url !== '/'
}

function joinURL(base: string, ...input: string[]) {
  let url = base || ''
  for (const segment of input.filter(url2 => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, '')
      url = withTrailingSlash(url) + _segment
    }
    else {
      url = segment
    }
  }
  return url
}

export function resolveModule(id: string, options: { paths?: string[] } = {}) {
  if (isAbsolute(id) && existsSync(id)) {
    const realPath2 = realpathSync(fileURLToPath(id))
    return pathToFileURL(realPath2).toString()
  }
  const _urls = (Array.isArray(options.paths) ? options.paths : []).map((p) => {
    return p.startsWith('file://') ? new URL(p) : pathToFileURL(slash(p))
  })
  if (!_urls.length)
    _urls.push(DEFAULT_ROOT_URL)
  const urls = [..._urls]

  for (const url of _urls) {
    if (url.protocol === 'file:') {
      urls.push(
        new URL('./', url),
        // If url is directory
        new URL(joinURL(url.pathname, '_index.js'), url),
        new URL('node_modules', url),
      )
    }
  }

  let resolved
  for (const url of urls) {
    resolved = _tryModuleResolve(id, url, DEFAULT_CONDITIONS_SET)
    if (resolved)
      break

    for (const prefix of ['', '/index']) {
      for (const extension of DEFAULT_EXTENSIONS) {
        resolved = _tryModuleResolve(
          id + prefix + extension,
          url,
          DEFAULT_CONDITIONS_SET,
        )
        if (resolved)
          break
      }
      if (resolved)
        break
    }
    if (resolved)
      break
  }
  if (!resolved) {
    const error = new Error(
      `Cannot find module ${id} imported from ${urls.join(', ')}`,
    )
    Object.assign(error, { code: 'ERR_MODULE_NOT_FOUND' })
    throw error
  }
  const realPath = realpathSync(fileURLToPath(resolved))
  return pathToFileURL(realPath).toString()
}

function isPackageExists(name: string, options: { paths?: string[] } = {}) {
  try {
    return !!resolveModule(name, options)
  }
  catch (error) {
    return false
  }
}

export class VitestPackageInstaller {
  async ensureInstalled(dependency: string, root: string) {
    if (process.env.VITEST_SKIP_INSTALL_CHECKS)
      return true

    if (process.versions.pnp) {
      const targetRequire = createRequire(__dirname)
      try {
        targetRequire.resolve(dependency, { paths: [root, __dirname] })
        return true
      }
      catch (error) {
      }
    }

    if (isPackageExists(dependency, { paths: [root, __dirname] }))
      return true

    const promptInstall = !isCI && process.stdout.isTTY

    process.stderr.write(c.red(`${c.inverse(c.red(' MISSING DEPENDENCY '))} Cannot find dependency '${dependency}'\n\n`))

    if (!promptInstall)
      return false

    const prompts = await import('prompts')
    const { install } = await prompts.prompt({
      type: 'confirm',
      name: 'install',
      message: c.reset(`Do you want to install ${c.green(dependency)}?`),
    })

    if (install) {
      await (await import('@antfu/install-pkg')).installPackage(dependency, { dev: true })
      // TODO: somehow it fails to load the package after installation, remove this when it's fixed
      process.stderr.write(c.yellow(`\nPackage ${dependency} installed, re-run the command to start.\n`))
      process.exit(EXIT_CODE_RESTART)
      return true
    }

    return false
  }
}
