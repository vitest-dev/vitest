import url from 'node:url'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { EXIT_CODE_RESTART } from '../constants'
import { isCI } from '../utils/env'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export async function ensurePackageInstalled(
  dependency: string,
  root: string,
  errorMessage?: string,
) {
  if (isPackageExists(dependency, { paths: [root, __dirname] }))
    return true

  const promptInstall = !isCI && process.stdout.isTTY

  if (errorMessage)
    process.stderr.write(c.red(errorMessage))

  process.stderr.write(c.red(`${c.inverse(c.red(' MISSING DEP '))} Can not find dependency '${dependency}'\n\n`))

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
