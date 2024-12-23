import { expect, test } from 'vitest'
import { userEvent, page, server } from '@vitest/browser/context'

test('non US keys', async () => {
  document.body.innerHTML = `
    <input placeholder="type-#7396" />
    <input placeholder="fill-#7396" />
    <input placeholder="type-emoji" />
    <input placeholder="fill-emoji" />
  `;

  await userEvent.type(page.getByPlaceholder("type-#7396"), 'éèù')
  await expect.element(page.getByPlaceholder("type-#7396")).toHaveValue('éèù')
  await userEvent.fill(page.getByPlaceholder("fill-#7396"), 'éèù')
  await expect.element(page.getByPlaceholder("fill-#7396")).toHaveValue('éèù')

  // playwright: garbled characters
  // webdriverio: error: invalid argument: missing command parameters
  // preview: ok
  try {
    await userEvent.type(page.getByPlaceholder("type-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("type-emoji")).toHaveValue('😊😍')
  } catch (e) {
    console.error(e)
  }

  // playwright: ok
  // webdriverio: error: ChromeDriver only supports characters in the BMP
  // preview: ok
  try {
    await userEvent.fill(page.getByPlaceholder("fill-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("fill-emoji")).toHaveValue('😊😍')
  } catch (e) {
    console.error(e)
  }
})

test('click with modifier', async () => {
  document.body.innerHTML = `
    <div id="test">test shift and click</div>
  `
  const el = document.getElementById("test")
  el.addEventListener("pointerup", (e) => {
    if (e.shiftKey && e.type === 'pointerup') {
      el.textContent += " [ok]"
    }
  });

  await userEvent.keyboard('{Shift>}')
  await userEvent.click(el)
  await userEvent.keyboard('{/Shift}')
  await expect.poll(() => el.textContent).toContain("[ok]")
})

// TODO: https://github.com/vitest-dev/vitest/issues/7118
// https://testing-library.com/docs/user-event/keyboard
// https://github.com/testing-library/user-event/blob/main/src/keyboard/keyMap.ts
// https://playwright.dev/docs/api/class-keyboard
// https://webdriver.io/docs/api/browser/keys/
test('special keys', async () => {
  async function testKeyboard(text: string) {
    let data: any;
    function handler(e: KeyboardEvent) {
      data = `${e.key}|${e.code}|${e.location}`;
    }
    document.addEventListener('keydown', handler)
    try {
      await userEvent.keyboard(text)
    } catch(e) {
      return 'ERROR';
    } finally {
      document.removeEventListener('keydown', handler)
    }
    return data
  }

  if (server.provider === 'playwright') {
    expect(await testKeyboard('{Shift}')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
    expect(await testKeyboard('{ShiftLeft}')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
    expect(await testKeyboard('{ShiftRight}')).toMatchInlineSnapshot(`"Shift|ShiftRight|2"`);
    expect(await testKeyboard('[Shift]')).toMatchInlineSnapshot(`undefined`);
    expect(await testKeyboard('[ShiftLeft]')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
    expect(await testKeyboard('[ShiftRight]')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
  }
  if (server.provider === 'webdriverio') {
    expect(await testKeyboard('{Shift}')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
    expect(await testKeyboard('{ShiftLeft}')).toMatchInlineSnapshot(`"ERROR"`);
    expect(await testKeyboard('{ShiftRight}')).toMatchInlineSnapshot(`"ERROR"`);
    expect(await testKeyboard('[Shift]')).toMatchInlineSnapshot(`"ERROR"`);
    expect(await testKeyboard('[ShiftLeft]')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
    expect(await testKeyboard('[ShiftRight]')).toMatchInlineSnapshot(`"Shift|ShiftLeft|1"`);
  }
  if (server.provider === 'preview') {
    expect(await testKeyboard('{Shift}')).toMatchInlineSnapshot(`"Shift|ShiftLeft|0"`);
    expect(await testKeyboard('{ShiftLeft}')).toMatchInlineSnapshot(`"ShiftLeft|Unknown|0"`);
    expect(await testKeyboard('{ShiftRight}')).toMatchInlineSnapshot(`"ShiftRight|Unknown|0"`);
    expect(await testKeyboard('[Shift]')).toMatchInlineSnapshot(`"Unknown|Shift|0"`);
    expect(await testKeyboard('[ShiftLeft]')).toMatchInlineSnapshot(`"Shift|ShiftLeft|0"`);
    expect(await testKeyboard('[ShiftRight]')).toMatchInlineSnapshot(`"Shift|ShiftRight|0"`);
  }
})
