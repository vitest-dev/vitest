import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { EXIT_CODE_RESTART } from '../constants'
import { isCI } from '../utils/env'

export async function ensurePackageInstalled(
  dependency: string,
  root: string,
) {
  if (isPackageExists(dependency, { paths: [root] }))
    return true

  const promptInstall = !isCI && process.stdout.isTTY

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
