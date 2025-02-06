import type { Agent } from '@antfu/install-pkg'
import type { BrowserBuiltinProvider } from '../../node/types/browser'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { detectPackageManager, installPackage } from '@antfu/install-pkg'
import { findUp } from 'find-up'
import prompt from 'prompts'
import { x } from 'tinyexec'
import c from 'tinyrainbow'
import { configFiles } from '../../constants'
import { generateExampleFiles } from './examples'

// eslint-disable-next-line no-console
const log = console.log

function getProviderOptions(): prompt.Choice[] {
  const providers: Record<BrowserBuiltinProvider, string> = {
    playwright: 'Playwright relies on Chrome DevTools protocol. Read more: https://playwright.dev',
    webdriverio: 'WebdriverIO uses WebDriver protocol. Read more: https://webdriver.io',
    preview: 'Preview is useful to quickly run your tests in the browser, but not suitable for CI.',
  }

  return Object.entries(providers).map<prompt.Choice>(([provider, description]) => {
    return {
      title: provider,
      description,
      value: provider,
    }
  })
}

function getBrowserNames(provider: BrowserBuiltinProvider) {
  switch (provider) {
    case 'webdriverio':
      return ['chrome', 'firefox', 'edge', 'safari']
    case 'playwright':
      return ['chromium', 'firefox', 'webkit']
    case 'preview':
      return ['chrome', 'firefox', 'safari']
  }
}

function getProviderPackageNames(provider: BrowserBuiltinProvider) {
  switch (provider) {
    case 'webdriverio':
      return {
        types: '@vitest/browser/providers/webdriverio',
        pkg: 'webdriverio',
      }
    case 'playwright':
      return {
        types: '@vitest/browser/providers/playwright',
        pkg: 'playwright',
      }
    case 'preview':
      return {
        types: '@vitest/browser/matchers',
        pkg: null,
      }
  }
  throw new Error(`Unsupported provider: ${provider}`)
}

function getFramework(): prompt.Choice[] {
  return [
    {
      title: 'vanilla',
      value: 'vanilla',
      description: 'No framework, just plain JavaScript or TypeScript.',
    },
    {
      title: 'vue',
      value: 'vue',
      description: '"The Progressive JavaScript Framework"',
    },
    {
      title: 'svelte',
      value: 'svelte',
      description: '"Svelte: cybernetically enhanced web apps"',
    },
    {
      title: 'react',
      value: 'react',
      description: '"The library for web and native user interfaces"',
    },
    {
      title: 'preact',
      value: 'preact',
      description: '"Fast 3kB alternative to React with the same modern API"',
    },
    {
      title: 'solid',
      value: 'solid',
      description: '"Simple and performant reactivity for building user interfaces"',
    },
    {
      title: 'marko',
      value: 'marko',
      description: '"A declarative, HTML-based language that makes building web apps fun"',
    },
  ]
}

function getFrameworkTestPackage(framework: string) {
  switch (framework) {
    case 'vanilla':
      return null
    case 'vue':
      return 'vitest-browser-vue'
    case 'svelte':
      return 'vitest-browser-svelte'
    case 'react':
      return 'vitest-browser-react'
    case 'preact':
      return '@testing-library/preact'
    case 'solid':
      return '@solidjs/testing-library'
    case 'marko':
      return '@marko/testing-library'
  }
  throw new Error(`Unsupported framework: ${framework}`)
}

function getFrameworkPluginPackage(framework: string) {
  switch (framework) {
    case 'vue':
      return '@vitejs/plugin-vue'
    case 'svelte':
      return '@sveltejs/vite-plugin-svelte'
    case 'react':
      return '@vitejs/plugin-react'
    case 'preact':
      return '@preact/preset-vite'
    case 'solid':
      return 'vite-plugin-solid'
    case 'marko':
      return '@marko/vite'
  }
  return null
}

async function updateTsConfig(type: string | undefined | null) {
  if (type == null) {
    return
  }
  const msg = `Add "${c.bold(type)}" to your tsconfig.json "${c.bold('compilerOptions.types')}" field to have better intellisense support.`
  log()
  log(c.yellow('◼'), c.yellow(msg))
}

function getLanguageOptions(): prompt.Choice[] {
  return [
    {
      title: 'TypeScript',
      description: 'Use TypeScript.',
      value: 'ts',
    },
    {
      title: 'JavaScript',
      description: 'Use plain JavaScript.',
      value: 'js',
    },
  ]
}

async function installPackages(pkgManager: string | null, packages: string[]) {
  if (!packages.length) {
    log(c.green('✔'), c.bold('All packages are already installed.'))
    return
  }

  log(c.cyan('◼'), c.bold('Installing packages...'))
  log(c.cyan('◼'), packages.join(', '))

  log()
  await installPackage(packages, { dev: true, packageManager: pkgManager ?? undefined })
}

function readPkgJson(path: string) {
  if (!existsSync(path)) {
    return null
  }
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content)
}

function getPossibleDefaults(dependencies: any) {
  const provider = getPossibleProvider(dependencies)
  const framework = getPossibleFramework(dependencies)
  return {
    lang: 'ts',
    provider,
    framework,
  }
}

function getPossibleFramework(dependencies: Record<string, string>) {
  if (dependencies.vue || dependencies['vue-tsc'] || dependencies['@vue/reactivity']) {
    return 'vue'
  }
  if (dependencies.react || dependencies['react-dom']) {
    return 'react'
  }
  if (dependencies.svelte || dependencies['@sveltejs/kit']) {
    return 'svelte'
  }
  if (dependencies.preact) {
    return 'preact'
  }
  if (dependencies['solid-js'] || dependencies['@solidjs/start']) {
    return 'solid'
  }
  if (dependencies.marko) {
    return 'marko'
  }
  return 'vanilla'
}

function getPossibleProvider(dependencies: Record<string, string>) {
  if (dependencies.webdriverio || dependencies['@wdio/cli'] || dependencies['@wdio/config']) {
    return 'webdriverio'
  }
  // playwright is the default recommendation
  return 'playwright'
}

function getProviderDocsLink(provider: string) {
  switch (provider) {
    case 'playwright':
      return 'https://vitest.dev/guide/browser/playwright'
    case 'webdriverio':
      return 'https://vitest.dev/guide/browser/webdriverio'
  }
}

function sort(choices: prompt.Choice[], value: string | undefined) {
  const index = choices.findIndex(i => i.value === value)
  if (index === -1) {
    return choices
  }
  const item = choices.splice(index, 1)[0]
  return [item, ...choices]
}

function fail() {
  process.exitCode = 1
}

async function generateWorkspaceFile(options: {
  configPath: string
  rootConfig: string
  provider: string
  browsers: string[]
}) {
  const relativeRoot = relative(dirname(options.configPath), options.rootConfig)
  const workspaceContent = [
    `import { defineWorkspace } from 'vitest/config'`,
    '',
    'export default defineWorkspace([',
    '  // If you want to keep running your existing tests in Node.js, uncomment the next line.',
    `  // '${relativeRoot}',`,
    `  {`,
    `    extends: '${relativeRoot}',`,
    `    test: {`,
    `      browser: {`,
    `        enabled: true,`,
    `        provider: '${options.provider}',`,
    options.provider !== 'preview' && `        // ${getProviderDocsLink(options.provider)}`,
    `        configs: [`,
    ...options.browsers.map(browser => `        { browser: '${browser}' },`),
    `        ],`,
    `      },`,
    `    },`,
    `  },`,
    `])`,
    '',
  ].filter(c => typeof c === 'string').join('\n')
  await writeFile(options.configPath, workspaceContent)
}

async function generateFrameworkConfigFile(options: {
  configPath: string
  framework: string
  frameworkPlugin: string | null
  provider: string
  browsers: string[]
}) {
  const frameworkImport = options.framework === 'svelte'
    ? `import { svelte } from '${options.frameworkPlugin}'`
    : `import ${options.framework} from '${options.frameworkPlugin}'`
  const configContent = [
    `import { defineConfig } from 'vitest/config'`,
    options.frameworkPlugin ? frameworkImport : null,
    ``,
    'export default defineConfig({',
    options.frameworkPlugin ? `  plugins: [${options.framework}()],` : null,
    `  test: {`,
    `    browser: {`,
    `      enabled: true,`,
    `      provider: '${options.provider}',`,
    options.provider !== 'preview' && `      // ${getProviderDocsLink(options.provider)}`,
    `      configs: [`,
    ...options.browsers.map(browser => `      { browser: '${browser}' },`),
    `      ],`,
    `    },`,
    `  },`,
    `})`,
    '',
  ].filter(t => typeof t === 'string').join('\n')
  // this file is only generated if there is already NO root config which is an edge case
  await writeFile(options.configPath, configContent)
}

async function updatePkgJsonScripts(pkgJsonPath: string, vitestScript: string) {
  if (!existsSync(pkgJsonPath)) {
    const pkg = {
      scripts: {
        'test:browser': vitestScript,
      },
    }
    await writeFile(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
  }
  else {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    pkg.scripts = pkg.scripts || {}
    pkg.scripts['test:browser'] = vitestScript
    await writeFile(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
  }
  log(c.green('✔'), 'Added "test:browser" script to your package.json.')
}

function getRunScript(pkgManager: Agent | null) {
  switch (pkgManager) {
    case 'yarn@berry':
    case 'yarn':
      return 'yarn test:browser'
    case 'pnpm@6':
    case 'pnpm':
      return 'pnpm test:browser'
    case 'bun':
      return 'bun test:browser'
    default:
      return 'npm run test:browser'
  }
}

function getPlaywrightRunArgs(pkgManager: Agent | null) {
  switch (pkgManager) {
    case 'yarn@berry':
    case 'yarn':
      return ['yarn', 'exec']
    case 'pnpm@6':
    case 'pnpm':
      return ['pnpx']
    case 'bun':
      return ['bunx']
    default:
      return ['npx']
  }
}

export async function create() {
  log(c.cyan('◼'), 'This utility will help you set up a browser testing environment.\n')

  const pkgJsonPath = resolve(process.cwd(), 'package.json')
  const pkg = readPkgJson(pkgJsonPath) || {}
  const dependencies = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  const defaults = getPossibleDefaults(dependencies)

  const { lang } = await prompt({
    type: 'select',
    name: 'lang',
    message: 'Choose a language for your tests',
    choices: sort(getLanguageOptions(), defaults?.lang),
  })

  if (!lang) {
    return fail()
  }

  const { provider } = await prompt({
    type: 'select',
    name: 'provider',
    message: 'Choose a browser provider. Vitest will use its API to control the testing environment',
    choices: sort(getProviderOptions(), defaults?.provider),
  })
  if (!provider) {
    return fail()
  }

  // TODO: allow multiselect
  const { browsers } = await prompt({
    type: 'multiselect',
    name: 'browsers',
    message: 'Choose a browser',
    choices: getBrowserNames(provider).map(browser => ({
      title: browser,
      value: browser,
    })),
  })
  if (!provider) {
    return fail()
  }

  const { framework } = await prompt({
    type: 'select',
    name: 'framework',
    message: 'Choose your framework',
    choices: sort(getFramework(), defaults?.framework),
  })
  if (!framework) {
    return fail()
  }

  let installPlaywright = false
  if (provider === 'playwright') {
    ;({ installPlaywright } = await prompt({
      type: 'confirm',
      name: 'installPlaywright',
      message: `Install Playwright browsers (can be done manually via 'pnpm exec playwright install')?`,
    }))
  }
  if (installPlaywright == null) {
    return fail()
  }

  const dependenciesToInstall = [
    '@vitest/browser',
  ]

  const frameworkPackage = getFrameworkTestPackage(framework)
  if (frameworkPackage) {
    dependenciesToInstall.push(frameworkPackage)
  }

  const providerPkg = getProviderPackageNames(provider)
  if (providerPkg.pkg) {
    dependenciesToInstall.push(providerPkg.pkg)
  }
  const frameworkPlugin = getFrameworkPluginPackage(framework)
  if (frameworkPlugin) {
    dependenciesToInstall.push(frameworkPlugin)
  }

  const pkgManager = await detectPackageManager()

  log()
  await installPackages(
    pkgManager,
    dependenciesToInstall.filter(pkg => !dependencies[pkg]),
  )

  const rootConfig = await findUp(configFiles, {
    cwd: process.cwd(),
  })

  let scriptCommand = 'vitest'

  log()

  if (rootConfig) {
    let browserWorkspaceFile = resolve(dirname(rootConfig), `vitest.workspace.${lang}`)
    if (existsSync(browserWorkspaceFile)) {
      log(c.yellow('⚠'), c.yellow('A workspace file already exists. Creating a new one for the browser tests - you can merge them manually if needed.'))
      browserWorkspaceFile = resolve(process.cwd(), `vitest.workspace.browser.${lang}`)
    }
    scriptCommand = `vitest --workspace=${relative(process.cwd(), browserWorkspaceFile)}`
    await generateWorkspaceFile({
      configPath: browserWorkspaceFile,
      rootConfig,
      provider,
      browsers,
    })
    log(c.green('✔'), 'Created a workspace file for browser tests:', c.bold(relative(process.cwd(), browserWorkspaceFile)))
  }
  else {
    const configPath = resolve(process.cwd(), `vitest.config.${lang}`)
    await generateFrameworkConfigFile({
      configPath,
      framework,
      frameworkPlugin,
      provider,
      browsers,
    })
    log(c.green('✔'), 'Created a config file for browser tests', c.bold(relative(process.cwd(), configPath)))
  }

  log()
  await updatePkgJsonScripts(pkgJsonPath, scriptCommand)

  if (installPlaywright) {
    log()
    const [command, ...args] = getPlaywrightRunArgs(pkgManager)
    const allArgs = [...args, 'playwright', 'install', '--with-deps']
    log(c.cyan('◼'), `Installing Playwright dependencies with \`${c.bold(command)} ${c.bold(allArgs.join(' '))}\`...`)
    log()
    await x(command, allArgs, {
      nodeOptions: {
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    })
  }

  // TODO: can we do this ourselves?
  if (lang === 'ts') {
    await updateTsConfig(providerPkg?.types)
  }

  log()
  const exampleTestFile = await generateExampleFiles(framework, lang)
  log(c.green('✔'), 'Created example test file in', c.bold(relative(process.cwd(), exampleTestFile)))
  log(c.dim('  You can safely delete this file once you have written your own tests.'))

  log()
  log(c.cyan('◼'), 'All done! Run your tests with', c.bold(getRunScript(pkgManager)))
}
