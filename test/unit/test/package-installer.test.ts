import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { VitestPackageInstaller } from '../../../packages/vitest/src/node/packageInstaller'

test.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
  'resolves an installed dependency without reading an inaccessible parent package.json',
  async () => {
    const temp = mkdtempSync(join(tmpdir(), 'vitest-11804-'))
    const project = join(temp, 'parent', 'proj')
    const ancestorPackage = join(temp, 'parent', 'package.json')
    const dependency = 'vitest-11804-fixture'
    const dependencyDir = join(project, 'node_modules', dependency)

    mkdirSync(dependencyDir, { recursive: true })

    writeFileSync(join(project, 'package.json'), '{"type":"module"}')
    writeFileSync(
      join(dependencyDir, 'package.json'),
      JSON.stringify({
        name: dependency,
        version: '1.0.0',
        main: 'index.js',
      }),
    )
    writeFileSync(join(dependencyDir, 'index.js'), 'module.exports = true')
    writeFileSync(ancestorPackage, '{}')

    chmodSync(ancestorPackage, 0o000)

    try {
      const installer = new VitestPackageInstaller()
      expect(await installer.ensureInstalled(dependency, project)).toBe(true)
    } finally {
      chmodSync(ancestorPackage, 0o644)
      rmSync(temp, { recursive: true, force: true })
    }
  },
)
