import { expect, it, vi } from 'vitest'

vi.mock('../src', () => ({
  hmm: 'baz',
}))

it('should return baz on hmm import', async () => {
  // @ts-expect-error 2339 - should resolve as expected on a mocked export
  expect(await import('../src').then(m => m.hmm)).toBe('baz')
})

it('should throw on foo import', async () => {
  await expect(() => import('../src').then((m) => { m.foo })).rejects
    .toThrowError(/\[vitest\] No \"foo\" export is defined on the \"..\/src\" mock defined here: /)
})

it('should throw on default import', async () => {
  await expect(() => import('../src').then((m) => { m.default })).rejects
    .toThrowError(/\[vitest\] No \"default\" export is defined on the \"..\/src\" mock defined here: /)
})
