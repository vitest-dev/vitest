import type { ResolvedConfig } from 'vitest/node'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, normalize, relative, resolve } from 'pathe'
import { distDir as vitestDist } from 'vitest/node'
import { distRoot } from './constants'

const _require = createRequire(import.meta.url)

export const defaultTesterHtmlPath: string = resolve(distRoot, 'client/tester/tester.html')

export function resolveTesterHtmlPath(config: ResolvedConfig): string {
  return config.browser.testerHtmlPath
    ? resolve(config.root, config.browser.testerHtmlPath)
    : defaultTesterHtmlPath
}

export interface BundledTesterPage {
  type: 'tester'
  template: string
  initScripts: string[]
}

interface BundledOrchestratorPage {
  type: 'orchestrator'
}

export type BundledPage = BundledTesterPage | BundledOrchestratorPage

/**
 * When the `client` environment is bundled, the tester and orchestrator pages
 * are HTML entries of the bundle. Vite names an HTML output by its path relative
 * to the root, so every page gets an id inside the root.
 */
export class BundledPages {
  public readonly pages: Map<string, BundledPage> = new Map()
  /**
   * Bare specifiers the tester imports, mapped to their entry points.
   */
  public readonly entryAliases: Map<string, string> = new Map()
  public orchestratorId = ''

  public root = ''

  public setup(root: string, configs: ResolvedConfig[]): string[] {
    this.root = root
    this.pages.clear()
    this.entryAliases.clear()
    this.orchestratorId = join(root, '__vitest_orchestrator__.html')
    this.pages.set(this.orchestratorId, { type: 'orchestrator' })
    for (const config of configs) {
      const template = resolveTesterHtmlPath(config)
      const initScripts = config.browser.provider?.initScripts ?? []
      this.pages.set(this.getTesterId(template, initScripts), {
        type: 'tester',
        template,
        initScripts,
      })
      const { enabled, provider } = config.coverage
      if (enabled && (provider === 'v8' || provider === 'istanbul')) {
        const id = `@vitest/coverage-${provider}/browser`
        // resolved like Vitest resolves the provider in Node.js
        this.entryAliases.set(id, normalize(_require.resolve(id, { paths: [vitestDist] })))
      }
    }
    return [...this.pages.keys(), ...this.entryAliases.values()]
  }

  public getTesterId(template: string, initScripts: string[]): string {
    const hash = createHash('sha256')
      .update([template, ...initScripts].join('\0'))
      .digest('hex')
      .slice(0, 8)
    // relative paths in the template resolve against the page id
    const dir = isInside(this.root, template) ? dirname(template) : this.root
    return join(dir, `__vitest_tester_${hash}__.html`)
  }

  public getOutputName(id: string): string {
    return relative(this.root, id)
  }
}

function isInside(root: string, file: string): boolean {
  const path = relative(root, file)
  return !!path && !path.startsWith('..') && !path.includes('node_modules')
}
