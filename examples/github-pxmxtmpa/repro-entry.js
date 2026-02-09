export async function test() {
  try {
    const result = await import('bad-dep')
    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, data: e }
  }
}
