/// <reference types="@vitest/browser/providers/playwright" />
import { test } from 'vitest'
import { userEvent, page } from "@vitest/browser/context"

test("basic", async () => {
  document.body.innerHTML = `<button>hello</button>`;
  await userEvent.click(page.getByRole('button'), { force: true });
})
