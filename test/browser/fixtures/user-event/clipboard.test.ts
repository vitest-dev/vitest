import { expect, test } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';

test('clipboard', async () => {
  // make it smaller since webdriverio fails when scaled
  page.viewport(300, 300)

  document.body.innerHTML = `
    <input placeholder="first" />
    <input placeholder="second" />
    <input placeholder="third" />
  `;

  // write first "hello" and copy to clipboard
  await userEvent.click(page.getByPlaceholder('first'));
  await userEvent.keyboard('hello');
  await userEvent.dblClick(page.getByPlaceholder('first'));
  await userEvent.copy();

  // paste into second
  await userEvent.click(page.getByPlaceholder('second'));
  await userEvent.paste();

  // append first "world" and cut
  await userEvent.click(page.getByPlaceholder('first'));
  await userEvent.keyboard('world');
  await userEvent.dblClick(page.getByPlaceholder('first'));
  await userEvent.cut();

  // paste it to third
  await userEvent.click(page.getByPlaceholder('third'));
  await userEvent.paste();

  expect([
    (page.getByPlaceholder('first').element() as any).value,
    (page.getByPlaceholder('second').element() as any).value,
    (page.getByPlaceholder('third').element() as any).value,
  ]).toMatchInlineSnapshot(`
    [
      "",
      "hello",
      "helloworld",
    ]
  `)
});
