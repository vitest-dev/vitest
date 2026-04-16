import { beforeEach, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.head.querySelectorAll('[data-trace-fixture]').forEach(node => node.remove())
  document.documentElement.scrollTop = 0
  document.body.innerHTML = ''
})

// TODO: record the capture viewport and replay with matching dimensions.
test('viewport media query depends on replay viewport', async () => {
  const style = document.createElement('style')
  style.dataset.traceFixture = ''
  style.textContent = `
.trace-viewport::before { content: "narrow"; }
@media (min-width: 800px) {
  .trace-viewport::before { content: "wide"; }
}
`
  document.head.append(style)
  document.body.innerHTML = '<div class="trace-viewport">viewport-sensitive layout</div>'
  await page.mark('viewport sensitive layout rendered')
})

// TODO: record window scroll offset in the snapshot payload and restore it during replay.
test('document scroll is not stored in snapshot payload', async () => {
  document.body.innerHTML = `
<main style="height: 2000px; padding-top: 900px">
  <button>Scrolled document button</button>
</main>
`
  window.scrollTo(0, 450)
  await page.getByRole('button').mark('document scrolled before mark')
})

test('overflow element scroll is stored in snapshot payload', async () => {
  document.body.innerHTML = `
<section
  data-testid="scroll-box"
  style="height: 80px; width: 180px; overflow: auto; border: 1px solid black"
>
  <div style="height: 240px; padding-top: 150px">
    <button>Nested scrolled button</button>
  </div>
</section>
`
  const scrollBox = document.querySelector<HTMLElement>('[data-testid="scroll-box"]')!
  scrollBox.scrollTop = 120
  await page.getByTestId('scroll-box').mark('overflow container scrolled before mark')
})
