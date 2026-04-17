import { beforeEach, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.head.querySelectorAll('[data-trace-fixture]').forEach(node => node.remove())
  document.body.innerHTML = ''
})

test('inline styles', async () => {
  document.body.innerHTML = '<button style="color: red">Hello</button>'
  await page.mark('button rendered with css')
})

test('style tag css is inlined', async () => {
  const style = document.createElement('style')
  style.dataset.traceFixture = ''
  style.textContent = `
.trace-style-tag {
  color: rgb(220, 38, 38);
  font-weight: 700;
}
.trace-style-tag:hover {
  background: rgb(253, 224, 71);
  color: rgb(30, 64, 175);
}
`
  document.head.append(style)
  document.body.innerHTML = '<button class="trace-style-tag">Hello</button>'
  await page.mark('button rendered with style tag css')
})

test('same-origin link css is inlined', async () => {
  // TODO(test): wait for the stylesheet load event so this actually proves
  // rrweb inlined loaded CSS instead of racing the snapshot against asset load.
  const link = document.createElement('link')
  link.dataset.traceFixture = ''
  link.rel = 'stylesheet'
  link.href = '/assets/trace-style.css'
  document.head.append(link)
  document.body.innerHTML = '<button class="trace-linked-css">Hello</button>'
  await page.mark('button rendered with same-origin linked css')
})

// TODO: capture or attach same-origin CSS subresources so replay does not depend on the original URL.
test('css url resources stay as urls', async () => {
  const style = document.createElement('style')
  style.dataset.traceFixture = ''
  style.textContent = '.trace-bg { width: 24px; height: 24px; background: url("/assets/trace-pixel.svg") center / contain no-repeat; }'
  document.head.append(style)
  document.body.innerHTML = '<div class="trace-bg" role="img" aria-label="local css background"></div>'
  await page.mark('element rendered with css url resource')
})

// TODO(test): this test is not meaningful for fidelity because the URL never loads; replace it with a loaded cross-origin fixture.
test('external stylesheet remains url dependent', async () => {
  const link = document.createElement('link')
  link.dataset.traceFixture = ''
  link.rel = 'stylesheet'
  link.href = 'https://example.invalid/trace-external.css'
  document.head.append(link)
  document.body.innerHTML = '<button class="trace-external-css">Hello</button>'
  await page.mark('button rendered with external stylesheet')
})

// TODO(test): this test is not meaningful for fidelity until /assets/trace-font.woff2 exists and successfully loads.
test('font files remain url dependent', async () => {
  const style = document.createElement('style')
  style.dataset.traceFixture = ''
  style.textContent = `
@font-face {
  font-family: "TraceFixtureFont";
  src: url("/assets/trace-font.woff2") format("woff2");
}
.trace-font {
  font-family: "TraceFixtureFont", sans-serif;
}
`
  document.head.append(style)
  document.body.innerHTML = '<button class="trace-font">Hello</button>'
  await page.mark('button rendered with font-face url')
})
