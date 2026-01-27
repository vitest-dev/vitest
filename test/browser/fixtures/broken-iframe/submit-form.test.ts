import { userEvent } from 'vitest/browser';
import { test } from 'vitest';

test('submitting a form reloads the iframe with "?" query', async () => {
  const form = document.createElement('form')
  document.body.append(form)
  form.id = 'form'
  const button = document.createElement('button')
  button.id = 'button'
  form.append(button)
  await userEvent.click(button)
})
