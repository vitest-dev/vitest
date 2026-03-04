import { existsSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const jsxExample = {
  name: 'HelloWorld.jsx',
  js: `
export default function HelloWorld({ name }) {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
}
`,
  ts: `
export default function HelloWorld({ name }: { name: string }) {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
}
`,
  test: `
import { expect, test } from 'vitest'
import { render } from '@testing-library/jsx'
import HelloWorld from './HelloWorld.<EXT>x'

test('renders name', async () => {
  const { getByText } = await render(<HelloWorld name="Vitest" />)
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
`,
}

const vueExample = {
  name: 'HelloWorld.vue',
  js: `
<script setup>
defineProps({
  name: String
})
</script>

<template>
  <div>
    <h1>Hello {{ name }}!</h1>
  </div>
</template>
`,
  ts: `
<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <div>
    <h1>Hello {{ name }}!</h1>
  </div>
</template>
`,
  test: `
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import HelloWorld from './HelloWorld.vue'

test('renders name', async () => {
  const { getByText } = render(HelloWorld, {
    props: { name: 'Vitest' },
  })
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
`,
}

const svelteExample = {
  name: 'HelloWorld.svelte',
  js: `
<script>
  export let name
</script>

<h1>Hello {name}!</h1>
`,
  ts: `
<script lang="ts">
  export let name: string
</script>

<h1>Hello {name}!</h1>
`,
  test: `
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-svelte'
import HelloWorld from './HelloWorld.svelte'

test('renders name', async () => {
  const { getByText } = render(HelloWorld, { name: 'Vitest' })
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
`,
}

const markoExample = {
  name: 'HelloWorld.marko',
  js: `
class {
  onCreate() {
    this.state = { name: null }
  }
}

<h1>Hello \${state.name}!</h1>
`,
  ts: `
export interface Input {
  name: string
}

<h1>Hello \${input.name}!</h1>
`,
  test: `
import { expect, test } from 'vitest'
import { render } from '@marko/testing-library'
import HelloWorld from './HelloWorld.svelte'

test('renders name', async () => {
  const { getByText } = await render(HelloWorld, { name: 'Vitest' })
  const element = getByText('Hello Vitest!')
  expect(element).toBeInTheDocument()
})
`,
}

const litExample = {
  name: 'HelloWorld.js',
  js: `
import { html, LitElement } from 'lit'

export class HelloWorld extends LitElement {
  static properties = {
    name: { type: String },
  }

  constructor() {
    super()
    this.name = 'World'
  }

  render() {
    return html\`<h1>Hello \${this.name}!</h1>\`
  }
}

customElements.define('hello-world', HelloWorld)
`,
  ts: `
import { html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('hello-world')
export class HelloWorld extends LitElement {
  @property({ type: String })
  name = 'World'

  render() {
    return html\`<h1>Hello \${this.name}!</h1>\`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hello-world': HelloWorld
  }
}
`,
  test: `
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-lit'
import { html } from 'lit'
import './HelloWorld.js'

test('renders name', async () => {
  const screen = render(html\`<hello-world name="Vitest"></hello-world>\`)
  const element = screen.getByText('Hello Vitest!')
  await expect.element(element).toBeInTheDocument()
})
`,
}

const qwikExample = {
  name: 'HelloWorld.jsx',
  js: `
import { component$ } from '@builder.io/qwik'

export default component$(({ name }) => {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
})
`,
  ts: `
import { component$ } from '@builder.io/qwik'

export default component$(({ name }: { name: string }) => {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
})
`,
  test: `
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-qwik'
import HelloWorld from './HelloWorld.tsx'

test('renders name', async () => {
  const { getByText } = render(<HelloWorld name="Vitest" />)
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
`,
}

const preactExample = {
  name: 'HelloWorld.jsx',
  js: `
export default function HelloWorld({ name }) {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
}
`,
  ts: `
export default function HelloWorld({ name }: { name: string }) {
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  )
}
`,
  test: `
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-preact'
import HelloWorld from './HelloWorld.<EXT>x'

test('renders name', async () => {
  const { getByText } = render(<HelloWorld name="Vitest" />)
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
`,
}

const vanillaExample = {
  name: 'HelloWorld.js',
  js: `
export default function HelloWorld({ name }) {
  const parent = document.createElement('div')

  const h1 = document.createElement('h1')
  h1.textContent = 'Hello ' + name + '!'
  parent.appendChild(h1)

  return parent
}
`,
  ts: `
export default function HelloWorld({ name }: { name: string }): HTMLDivElement {
  const parent = document.createElement('div')

  const h1 = document.createElement('h1')
  h1.textContent = 'Hello ' + name + '!'
  parent.appendChild(h1)

  return parent
}
`,
  test: `
import { expect, test } from 'vitest'
import { getByText } from '@testing-library/dom'
import HelloWorld from './HelloWorld.js'

test('renders name', () => {
  const parent = HelloWorld({ name: 'Vitest' })
  document.body.appendChild(parent)

  const element = getByText(parent, 'Hello Vitest!')
  expect(element).toBeInTheDocument()
})
`,
}

function getExampleTest(framework: string) {
  switch (framework) {
    case 'solid':
      return {
        ...jsxExample,
        test: jsxExample.test.replace('@testing-library/jsx', `@testing-library/${framework}`),
      }
    case 'preact':
      return preactExample
    case 'react':
      return {
        ...jsxExample,
        test: jsxExample.test.replace('@testing-library/jsx', `vitest-browser-${framework}`),
      }
    case 'vue':
      return vueExample
    case 'svelte':
      return svelteExample
    case 'lit':
      return litExample
    case 'marko':
      return markoExample
    case 'qwik':
      return qwikExample
    default:
      return vanillaExample
  }
}

export async function generateExampleFiles(framework: string, lang: 'ts' | 'js'): Promise<string> {
  const example = getExampleTest(framework)
  let fileName = example.name
  const folder = resolve(process.cwd(), 'vitest-example')
  const fileContent = example[lang]

  if (!existsSync(folder)) {
    await mkdir(folder, { recursive: true })
  }
  const isJSX = fileName.endsWith('.jsx')

  if (isJSX && lang === 'ts') {
    fileName = fileName.replace('.jsx', '.tsx')
  }
  else if (fileName.endsWith('.js') && lang === 'ts') {
    fileName = fileName.replace('.js', '.ts')
  }

  example.test = example.test.replace('<EXT>', lang)

  const filePath = resolve(folder, fileName)
  const testPath = resolve(folder, `HelloWorld.test.${isJSX ? `${lang}x` : lang}`)
  writeFileSync(filePath, fileContent.trimStart(), 'utf-8')
  writeFileSync(testPath, example.test.trimStart(), 'utf-8')
  return testPath
}
