import type { Agent } from '@antfu/install-pkg'
import type { BrowserBuiltinProvider } from '../../node/types/browser'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { detectPackageManager, installPackage } from '@antfu/install-pkg'
import * as find from 'empathic/find'
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
      title: 'lit',
      value: 'lit',
      description: '"A simple library for building fast, lightweight web components."',
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
    {
      title: 'qwik',
      value: 'qwik',
      description: '"Instantly interactive web apps at scale"',
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
    case 'lit':
      return 'vitest-browser-lit'
    case 'preact':
      return 'vitest-browser-preact'
    case 'solid':
      return '@solidjs/testing-library'
    case 'marko':
      return '@marko/testing-library'
    case 'qwik':
      return 'vitest-browser-qwik'
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
    case 'qwik':
      return '@builder.io/qwik/optimizer'
  }
  return null
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
  if (dependencies.lit || dependencies['lit-html']) {
    return 'lit'
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
  if (dependencies['@builder.io/qwik'] || dependencies['@qwik.dev/core']) {
    return 'qwik'
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
      return 'https://vitest.dev/config/browser/playwright'
    case 'webdriverio':
      return 'https://vitest.dev/config/browser/webdriverio'
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

function getFrameworkImportInfo(framework: string) {
  switch (framework) {
    case 'svelte':
      return { importName: 'svelte', isNamedExport: true }
    case 'qwik':
      return { importName: 'qwikVite', isNamedExport: true }
    default:
      return { importName: framework, isNamedExport: false }
  }
}

async function generateFrameworkConfigFile(options: {
  configPath: string
  framework: string
  frameworkPlugin: string | null
  provider: string
  browsers: string[]
}) {
  const { importName, isNamedExport } = getFrameworkImportInfo(options.framework)

  const frameworkImport = isNamedExport
    ? `import { ${importName} } from '${options.frameworkPlugin}'`
    : `import ${importName} from '${options.frameworkPlugin}'`

  const configContent = [
    `import { defineConfig } from 'vitest/config'`,
    `import { ${options.provider} } from '@vitest/browser-${options.provider}'`,
    options.frameworkPlugin ? frameworkImport : null,
    ``,
    'export default defineConfig({',
    options.frameworkPlugin ? `  plugins: [${importName}()],` : null,
    `  test: {`,
    `    browser: {`,
    `      enabled: true,`,
    `      provider: ${options.provider}(),`,
    options.provider !== 'preview' && `      // ${getProviderDocsLink(options.provider)}`,
    `      instances: [`,
    ...options.browsers.map(browser => `        { browser: '${browser}' },`),
    `      ],`,
    `    },`,
    `  },`,
    `})`,
    '',
  ].filter(t => typeof t === 'string').join('\n')
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

export async function create(): Promise<void> {
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
    `@vitest/browser-${provider}`,
  ]

  const frameworkPackage = getFrameworkTestPackage(framework)
  if (frameworkPackage) {
    dependenciesToInstall.push(frameworkPackage)
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

  const rootConfig = find.any(configFiles, {
    cwd: process.cwd(),
  })

  let scriptCommand = 'vitest'

  log()

  if (rootConfig) {
    const configPath = resolve(dirname(rootConfig), `vitest.browser.config.${lang}`)
    scriptCommand = `vitest --config=${relative(process.cwd(), configPath)}`
    await generateFrameworkConfigFile({
      configPath,
      framework,
      frameworkPlugin,
      provider,
      browsers,
    })
    log(
      c.green('✔'),
      'Created a new config file for browser tests:',
      c.bold(relative(process.cwd(), configPath)),
      // TODO: Can we modify the config ourselves?
      '\nSince you already have a Vitest config file, it is recommended to copy the contents of the new file ',
      'into your existing config located at ',
      c.bold(relative(process.cwd(), rootConfig)),
    )
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
    log(c.green('✔'), 'Created a config file for browser tests:', c.bold(relative(process.cwd(), configPath)))
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

  log()
  const exampleTestFile = await generateExampleFiles(framework, lang)
  log(c.green('✔'), 'Created example test file in', c.bold(relative(process.cwd(), exampleTestFile)))
  log(c.dim('  You can safely delete this file once you have written your own tests.'))

  log()
  log(c.cyan('◼'), 'All done! Run your tests with', c.bold(getRunScript(pkgManager)))
}
