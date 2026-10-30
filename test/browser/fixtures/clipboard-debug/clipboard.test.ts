import { expect, test } from 'vitest';
import { page, server, userEvent } from 'vitest/browser';

// Instrumented copy of fixtures/user-event/clipboard.test.ts to debug a Windows-only Firefox flake.
test('clipboard', async () => {
  const log: string[] = []
  const t0 = performance.now()
  const stamp = () => `+${Math.round(performance.now() - t0)}ms`

  page.viewport(300, 300)

  document.body.innerHTML = `
    <input placeholder="first" />
    <input placeholder="second" />
    <input placeholder="third" />
  `;

  const inputs = ['first', 'second', 'third'].map(
    name => page.getByPlaceholder(name).element() as HTMLInputElement,
  )

  const snapshot = (label: string) => {
    const active = document.activeElement as HTMLInputElement | null
    log.push(
      `${stamp()} ${label}: values=${JSON.stringify(inputs.map(i => i.value))} `
      + `active=${active?.placeholder || active?.tagName} `
      + `sel=${active && 'selectionStart' in active ? `${active.selectionStart}-${active.selectionEnd}` : '-'} `
      + `docSel=${JSON.stringify(document.getSelection()?.toString())} `
      + `rects=${inputs.map(i => { const r = i.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}` }).join('|')} `
      + `vw=${window.innerWidth}x${window.innerHeight} `
      + `hasFocus=${document.hasFocus()} topHasFocus=${(() => { try { return window.top!.document.hasFocus() } catch { return '?' } })()} `
      + `visibility=${document.visibilityState}`,
    )
  }

  for (const type of ['copy', 'cut', 'paste'] as const) {
    document.addEventListener(type, (e) => {
      const target = e.target as HTMLInputElement
      log.push(`${stamp()} event:${type} target=${target.placeholder} data=${JSON.stringify(e.clipboardData?.getData('text/plain'))}`)
    }, true)
  }
  for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'focus', 'blur', 'select', 'keydown'] as const) {
    document.addEventListener(type, (e) => {
      const target = e.target as HTMLInputElement
      const extra = e instanceof MouseEvent
        ? ` detail=${e.detail} xy=${e.clientX},${e.clientY}`
        : e instanceof KeyboardEvent ? ` key=${e.key} ctrl=${e.ctrlKey} meta=${e.metaKey}` : ''
      log.push(`${stamp()} event:${type} target=${target.placeholder || target.tagName || 'document'}${extra}`)
    }, true)
  }
  window.addEventListener('resize', () => log.push(`${stamp()} event:resize ${window.innerWidth}x${window.innerHeight}`))

  snapshot('start')

  await userEvent.click(page.getByPlaceholder('first'));
  snapshot('click first')
  await userEvent.keyboard('hello');
  snapshot('type hello')
  await userEvent.dblClick(page.getByPlaceholder('first'));
  snapshot('dblClick first')
  await userEvent.copy();
  snapshot('copy')

  await userEvent.click(page.getByPlaceholder('second'));
  snapshot('click second')
  await userEvent.paste();
  snapshot('paste')

  await userEvent.click(page.getByPlaceholder('first'));
  snapshot('click first')
  await userEvent.keyboard('world');
  snapshot('type world')
  await userEvent.dblClick(page.getByPlaceholder('first'));
  snapshot('dblClick first')
  await userEvent.cut();
  snapshot('cut')

  await userEvent.click(page.getByPlaceholder('third'));
  snapshot('click third')
  await userEvent.paste();
  snapshot('paste')

  const values = inputs.map(i => i.value)
  const ok = JSON.stringify(values) === JSON.stringify(['', 'hello', 'helloworld'])
  if (!ok) {
    console.error(`CLIPBOARD_DEBUG ${server.browser} MISMATCH\n${log.join('\n')}`)
  }

  expect(values).toEqual(['', 'hello', 'helloworld'])
});
