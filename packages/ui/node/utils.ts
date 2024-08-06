import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import type { Vitest } from 'vitest'
import { toArray } from '@vitest/utils'
import { basename, resolve } from 'pathe'
import { coverageConfigDefaults } from 'vitest/config'
import fg from 'fast-glob'

export function transformCoverageEntryPoint(
  entryPoint: string,
) {
  return entryPoint.replace('</head>', `<script>
(() => {
 const theme = 'vueuse-color-scheme'
 const preference = localStorage.getItem(theme)
 const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
 if (!preference || preference === 'auto' ? prefersDark : preference === 'dark')
   document.documentElement.classList.add('dark')

 window.addEventListener('storage', (e) => {
   if (e.key === theme) {
     document.documentElement.classList.remove('dark')
     if (!e.newValue || e.newValue === 'auto' ? prefersDark : e.newValue === 'dark')
        document.documentElement.classList.add('dark')
   }
 })
})();
</script>
</head>`)
}

export async function prepareReportCoverageFolder(ctx: Vitest) {
  const [folder] = resolveCoverageFolder(ctx)!
  const root = resolve(fileURLToPath(import.meta.url), '../')
  await Promise.all([
    fs.copyFile(resolve(root, '../istanbul-base.css'), resolve(folder, 'base.css')),
    fs.copyFile(resolve(root, '../istanbul-prettify.css'), resolve(folder, 'prettify.css')),
  ])
  await Promise.all(fg.sync('**/*.html', { cwd: folder, absolute: true }).map(async (file) => {
    const content = await fs.readFile(file, 'utf-8')
    await fs.writeFile(file, transformCoverageEntryPoint(content))
  }))
}

export function resolveCoverageFolder(ctx: Vitest) {
  const options = ctx.config
  const htmlReporter
    = options.api?.port && options.coverage?.enabled
      ? toArray(options.coverage.reporter).find((reporter) => {
        if (typeof reporter === 'string') {
          return reporter === 'html'
        }

        return reporter[0] === 'html'
      })
      : undefined

  if (!htmlReporter) {
    return undefined
  }

  // reportsDirectory not resolved yet
  const root = resolve(
    ctx.config?.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
  )

  const subdir
    = Array.isArray(htmlReporter)
    && htmlReporter.length > 1
    && 'subdir' in htmlReporter[1]
      ? htmlReporter[1].subdir
      : undefined

  if (!subdir || typeof subdir !== 'string') {
    return [root, `/${basename(root)}/`]
  }

  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`]
}
