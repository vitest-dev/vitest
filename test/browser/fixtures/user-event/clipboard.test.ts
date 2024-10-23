import { expect, test } from 'vitest';
import { page, userEvent, server } from '@vitest/browser/context';

test('clipboard', async () => {
  document.body.innerHTML = `
    <input placeholder="first" />
    <input placeholder="second" />
    <input placeholder="third" />
  `;

  // https://webdriver.io/docs/api/browser/keys/
  // https://playwright.dev/docs/api/class-keyboard
  const modifier =
    server.provider === 'webdriverio'
      ? 'Ctrl'
      : server.provider === 'playwright'
      ? 'ControlOrMeta'
      : 'Control';
  const copy = `{${modifier}>}{c}{/${modifier}}`;
  const cut = `{${modifier}>}{x}{/${modifier}}`;
  const paste = `{${modifier}>}{v}{/${modifier}}`;

  // write first "hello" and copy to clipboard
  await userEvent.click(page.getByPlaceholder('first'));
  await userEvent.keyboard('hello');
  await userEvent.keyboard(`{selectall}`);
  await userEvent.keyboard(copy);

  // paste twice into second
  await userEvent.click(page.getByPlaceholder('second'));
  await userEvent.keyboard(paste);
  await userEvent.keyboard(paste);

  // cut first "hello"
  await userEvent.click(page.getByPlaceholder('first'));
  await userEvent.keyboard(`{selectall}`);
  await userEvent.keyboard(cut);

  // paste it to third
  await userEvent.click(page.getByPlaceholder('third'));
  await userEvent.keyboard(paste);

  // hellohello
  expect([
    (page.getByPlaceholder('first').element() as any).value,
    (page.getByPlaceholder('second').element() as any).value,
    (page.getByPlaceholder('third').element() as any).value,
  ]).toMatchInlineSnapshot(`
    [
      "",
      "hellohello",
      "hello",
    ]
  `)
});
