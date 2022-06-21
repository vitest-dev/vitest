import fs from 'fs/promises'

export async function validateNoSnapshots(filepath: string) {
  const content = await fs.readFile(filepath, 'utf8')

  if (content.includes('toMatchInlineSnapshot(`'))
    expect.fail('snapshots should not be generated before running test')
}
