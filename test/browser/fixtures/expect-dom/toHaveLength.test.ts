import { describe, expect, test } from 'vitest';
import { render } from './utils';
import { page } from 'vitest/browser';

describe('.toHaveLength', () => {
  test('accepts locator', async () => {
    render(`
      <button></button>
      <button></button>
      <button></button>
    `)

    await expect.element(page.getByRole('button')).toHaveLength(3)
    await expect.element(page.getByRole('button')).not.toHaveLength(0)

    expect(page.getByRole('button')).toHaveLength(3)
    expect(page.getByRole('button')).not.toHaveLength(0)
  })
})
