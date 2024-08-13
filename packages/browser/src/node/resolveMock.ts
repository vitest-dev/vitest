import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'pathe'
import type { PartialResolvedId } from 'rollup'
import type { ResolvedConfig, WorkspaceProject } from 'vitest/node'
import { findMockRedirect } from '@vitest/mocker/node'
import type { ResolvedConfig as ViteConfig } from 'vite'

export async function resolveMock(
  project: WorkspaceProject,
  rawId: string,
  importer: string,
  hasFactory: boolean,
) {
  const { id, fsPath, external } = await resolveId(project, rawId, importer)

  if (hasFactory) {
    const needsInteropMap = viteDepsInteropMap(project.browser!.vite.config)
    const needsInterop = needsInteropMap?.get(fsPath) ?? false
    return { type: 'factory' as const, resolvedId: id, needsInterop }
  }

  const redirectUrl = findMockRedirect(project.config.root, fsPath, external)

  return {
    type: redirectUrl === null ? ('automock' as const) : ('redirect' as const),
    redirectUrl,
    resolvedId: id,
  }
}

async function resolveId(project: WorkspaceProject, rawId: string, importer: string) {
  const resolved = await project.browser!.vite.pluginContainer.resolveId(
    rawId,
    importer,
    {
      ssr: false,
    },
  )
  return resolveModule(project, rawId, resolved)
}

async function resolveModule(project: WorkspaceProject, rawId: string, resolved: PartialResolvedId | null) {
  const id = resolved?.id || rawId
  const external
    = !isAbsolute(id) || isModuleDirectory(project.config, id) ? rawId : null
  return {
    id,
    fsPath: cleanUrl(id),
    external,
  }
}

function isModuleDirectory(config: ResolvedConfig, path: string) {
  const moduleDirectories = config.server.deps?.moduleDirectories || [
    '/node_modules/',
  ]
  return moduleDirectories.some((dir: string) => path.includes(dir))
}

const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

const metadata = new WeakMap<ViteConfig, Map<string, boolean>>()

function viteDepsInteropMap(config: ViteConfig) {
  if (metadata.has(config)) {
    return metadata.get(config)!
  }
  const cacheDirPath = getDepsCacheDir(config)
  const metadataPath = resolve(cacheDirPath, '_metadata.json')
  if (!existsSync(metadataPath)) {
    return null
  }
  const { optimized } = JSON.parse(readFileSync(metadataPath, 'utf-8'))
  const needsInteropMap = new Map()
  for (const name in optimized) {
    const dep = optimized[name]
    const file = resolve(cacheDirPath, dep.file)
    needsInteropMap.set(file, dep.needsInterop)
  }
  metadata.set(config, needsInteropMap)
  return needsInteropMap
}

function getDepsCacheDir(config: ViteConfig): string {
  return resolve(config.cacheDir, 'deps')
}
