import { expect, it } from 'vitest'

it('cannot import json without an assertion in an external file', async () => {
  try {
    await import('../src/external/import-json.js')
    expect.unreachable()
  }
  catch (err) {
    const message = err.message.replace(new RegExp(process.cwd(), 'g'), '<root>')
    expect(message).toMatchInlineSnapshot(`
      "Cannot import JSON file \\"file://<root>/src/table.json\\" (imported from \\"file://<root>/src/external/import-json.js\\") without specifying \`assert: { type: \\"json\\" }\`.

      This error happened because you enabled \\"strict\\" option in your \\"test.environmentOptions.node\\" configuration and have \\"node\\" environment enabled.
      To not see this error, fix the issue described above or disable this behavior by setting \\"strict\\" to \\"false\\".
      "
    `)
  }
})

// TODO: importing other typesm check "validate-assertion" conditions
