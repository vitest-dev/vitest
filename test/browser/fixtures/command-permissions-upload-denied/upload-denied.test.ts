import { userEvent } from '@vitest/browser/context'
import { test } from 'vitest'

test('upload denied path', async () => {
  const input = document.createElement('input')
  input.type = 'file'
  document.body.append(input)
  // the file exists in the project, but is denied via `server.fs.deny`
  await userEvent.upload(input, 'my-secret.txt')
})
