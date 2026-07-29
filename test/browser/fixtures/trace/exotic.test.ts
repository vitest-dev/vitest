import { beforeEach, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  if ('adoptedStyleSheets' in document) {
    document.adoptedStyleSheets = []
  }
  document.body.innerHTML = ''
})

test('canvas pixels are captured for replay', async () => {
  document.body.innerHTML = '<canvas data-testid="trace-canvas" width="80" height="40"></canvas>'
  const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="trace-canvas"]')!
  const context = canvas.getContext('2d')!
  context.fillStyle = 'rgb(220, 38, 38)'
  context.fillRect(0, 0, 80, 40)
  await page.getByTestId('trace-canvas').mark('canvas drawn before mark')
})

test('shadow dom is rebuilt and highlightable by mirror id', async () => {
  const host = document.createElement('section')
  host.setAttribute('aria-label', 'shadow host')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<button>Shadow button</button>'
  document.body.append(host)
  await page.getByRole('button', { name: 'Shadow button' }).mark('shadow button rendered')
})

// TODO: document or improve the boundary between rebuilt DOM shape and custom element runtime behavior.
test('custom element dom shape is rebuilt without runtime behavior', async () => {
  if (!customElements.get('trace-widget')) {
    customElements.define(
      'trace-widget',
      class extends HTMLElement {
        connectedCallback() {
          this.attachShadow({ mode: 'open' }).innerHTML = '<button>Custom element button</button>'
        }
      },
    )
  }

  document.body.innerHTML = '<trace-widget></trace-widget>'
  await page.getByRole('button', { name: 'Custom element button' }).mark('custom element rendered')
})

// TODO: collect adopted stylesheets so replay preserves constructable stylesheet styling.
test('adopted stylesheets are not captured by snapshot alone', async () => {
  document.body.innerHTML = '<button>Adopted stylesheet button</button>'
  if ('adoptedStyleSheets' in document) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('button { color: rgb(220, 38, 38); }')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }
  await page.getByRole('button').mark('button rendered with adopted stylesheet')
})
