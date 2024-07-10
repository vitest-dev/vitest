import url from 'node:url'
import { createRequire } from 'node:module'
import c from 'tinyrainbow'
import { isPackageExists } from 'local-pkg'
import { isCI } from '../utils/env'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export class VitestPackageInstaller {
  async ensureInstalled(dependency: string, root: string) {
    if (process.env.VITEST_SKIP_INSTALL_CHECKS) {
      return true
    }

    if (process.versions.pnp) {
      const targetRequire = createRequire(__dirname)
      try {
        targetRequire.resolve(dependency, { paths: [root, __dirname] })
        return true
      }
      catch (error) {}
    }

    if (
      /* @__PURE__ */ isPackageExists(dependency, { paths: [root, __dirname] })
    ) {
      return true
    }

    const promptInstall = !isCI && process.stdout.isTTY

    process.stderr.write(
      c.red(
        `${c.inverse(
          c.red(' MISSING DEPENDENCY '),
        )} Cannot find dependency '${dependency}'\n\n`,
      ),
    )

    if (!promptInstall) {
      return false
    }

    const prompts = await import('prompts')
    const { install } = await prompts.prompt({
      type: 'confirm',
      name: 'install',
      message: c.reset(`Do you want to install ${c.green(dependency)}?`),
    })

    if (install) {
      await (
        await import('@antfu/install-pkg')
      ).installPackage(dependency, { dev: true })
      // TODO: somehow it fails to load the package after installation, remove this when it's fixed
      process.stderr.write(
        c.yellow(
          `\nPackage ${dependency} installed, re-run the command to start.\n`,
        ),
      )
      process.exit()
      return true
    }

    return false
  }
}
