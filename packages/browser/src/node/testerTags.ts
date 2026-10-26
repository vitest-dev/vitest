import type { HtmlTagDescriptor, Manifest } from 'vite'
import type { ParentBrowserProject } from './projectParent'
import { join, resolve } from 'pathe'
import { defaultTesterHtmlPath } from './bundledPages'
import { distRoot, errorCatcherPath, matchersPath } from './constants'

export interface TesterTagsOptions {
  template: string
  initScripts: string[]
  /**
   * The bundle resolves scripts by their file paths.
   */
  bundled: boolean
}

export async function createTesterTags(
  parent: ParentBrowserProject,
  { template, initScripts, bundled }: TesterTagsOptions,
): Promise<HtmlTagDescriptor[]> {
  const resolveUrl = (file: string) => (bundled ? file : join('/@fs/', file))
  const stateJs = typeof parent.stateJs === 'string' ? parent.stateJs : await parent.stateJs

  const testerTags: HtmlTagDescriptor[] = []

  if (template !== defaultTesterHtmlPath) {
    const manifest: Manifest =
      parent.manifest instanceof Promise ? await parent.manifest : parent.manifest
    const testerEntry = manifest['tester/tester.html']

    testerTags.push({
      tag: 'script',
      attrs: {
        type: 'module',
        crossorigin: '',
        src: bundled
          ? resolve(distRoot, 'client', testerEntry.file)
          : `${parent.base}${testerEntry.file}`,
      },
      injectTo: 'head',
    })

    for (const importName of bundled ? [] : testerEntry.imports || []) {
      const entryManifest = manifest[importName]
      if (entryManifest) {
        testerTags.push({
          tag: 'link',
          attrs: {
            href: `${parent.base}${entryManifest.file}`,
            rel: 'modulepreload',
            crossorigin: '',
          },
          injectTo: 'head',
        })
      }
    }
  } else {
    // inject the reset style only in the default template,
    // allowing users to customize the style in their own template
    testerTags.push({
      tag: 'style',
      children: `
html {
  padding: 0;
  margin: 0;
}
body {
  padding: 0;
  margin: 0;
  min-height: 100vh;
}`,
      injectTo: 'head',
    })
  }

  return [
    {
      tag: 'script',
      children: '{__VITEST_INJECTOR__}',
      injectTo: 'head-prepend',
    },
    {
      tag: 'script',
      children: stateJs,
      injectTo: 'head-prepend',
    },
    {
      tag: 'script',
      attrs: {
        type: 'module',
        src: resolveUrl(errorCatcherPath),
      },
      injectTo: 'head',
    },
    {
      tag: 'script',
      attrs: {
        type: 'module',
        src: resolveUrl(matchersPath),
      },
      injectTo: 'head',
    },
    ...initScripts.map((script): HtmlTagDescriptor => ({
      tag: 'script',
      attrs: {
        type: 'module',
        src: resolveUrl(script),
      },
      injectTo: 'head',
    })),
    ...testerTags,
  ]
}
