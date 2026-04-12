import { expect, test } from 'vitest'
import { userEvent, page, server } from 'vitest/browser'

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
  if (server.provider === 'playwright') {
    await userEvent.type(page.getByPlaceholder("type-emoji"), '😊😍')
    if (server.browser === 'chromium') {
      await expect.element(page.getByPlaceholder("type-emoji")).toHaveValue('����')
    } else {
      await expect.element(page.getByPlaceholder("type-emoji")).toHaveValue('😊😍')
    }
  } else if (server.provider === 'webdriverio') {
    await expect(() =>
      userEvent.type(page.getByPlaceholder("type-emoji"), '😊😍')
    ).rejects.toThrow()
  } else {
    await userEvent.type(page.getByPlaceholder("type-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("type-emoji")).toHaveValue('😊😍')
  }

  // playwright: ok
  // webdriverio: error: ChromeDriver only supports characters in the BMP
  // preview: ok
  if (server.provider === 'webdriverio') {
    if (server.browser === 'firefox') {
      await userEvent.fill(page.getByPlaceholder("fill-emoji"), '😊😍')
      await expect.element(page.getByPlaceholder("fill-emoji")).toHaveValue('😊😍')
    } else {
      await expect(() =>
        userEvent.fill(page.getByPlaceholder("fill-emoji"), '😊😍')
      ).rejects.toThrow()
    }
  } else {
    await userEvent.fill(page.getByPlaceholder("fill-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("fill-emoji")).toHaveValue('😊😍')
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
  // By using an empty object as the option, this opts in to using a chain of actions instead of an elementClick in webdriver.
  await userEvent.click(el, {})
  await userEvent.keyboard('{/Shift}')
  await expect.poll(() => el.textContent).toContain("[ok]")
})

// Provider-specific behavior referenced in https://github.com/vitest-dev/vitest/issues/7118.
// These assertions document the current limits of special-key support so docs can be explicit
// about which aliases are portable and which ones depend on the active provider.
test('special key aliases differ between providers', async () => {
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
