import { createRequire } from 'node:module'
import url from 'node:url'
import { isPackageExists } from 'local-pkg'
import c from 'tinyrainbow'
import { isTTY } from '../utils/env'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export class VitestPackageInstaller {
  isPackageExists(name: string, options?: { paths?: string[] }) {
    return isPackageExists(name, options)
  }

  async ensureInstalled(dependency: string, root: string, version?: string) {
    if (process.env.VITEST_SKIP_INSTALL_CHECKS) {
      return true
    }

    if (process.versions.pnp) {
      const targetRequire = createRequire(__dirname)
      try {
        targetRequire.resolve(dependency, { paths: [root, __dirname] })
        return true
      }
      catch {}
    }

    if (
      /* @__PURE__ */ isPackageExists(dependency, { paths: [root, __dirname] })
    ) {
      return true
    }

    process.stderr.write(
      c.red(
        `${c.inverse(
          c.red(' MISSING DEPENDENCY '),
        )} Cannot find dependency '${dependency}'\n\n`,
      ),
    )

    if (!isTTY) {
      return false
    }

    const prompts = await import('prompts')
    const { install } = await prompts.default({
      type: 'confirm',
      name: 'install',
      message: c.reset(`Do you want to install ${c.green(dependency)}?`),
    })

    if (install) {
      const packageName = version ? `${dependency}@${version}` : dependency
      await (
        await import('@antfu/install-pkg')
      ).installPackage(packageName, { dev: true })
      // TODO: somehow it fails to load the package after installation, remove this when it's fixed
      process.stderr.write(
        c.yellow(
          `\nPackage ${packageName} installed, re-run the command to start.\n`,
        ),
      )
      process.exit()
      return true
    }

    return false
  }
}
