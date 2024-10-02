import { describe, expect, it, onTestFailed, onTestFinished } from 'vitest'

const collected: any[] = []
const multiple: any[] = []

it('on-finished regular', () => {
  collected.push(1)
  onTestFinished(() => {
    collected.push(3)
  })
  collected.push(2)
})

it('on-finished context', (t) => {
  collected.push(4)
  t.onTestFinished(() => {
    collected.push(6)
  })
  collected.push(5)
})

it.fails('failed finish', () => {
  collected.push(7)
  onTestFinished(() => {
    collected.push(9)
  })
  collected.push(8)
  expect.fail('failed')
  collected.push(null)
})

it.fails('failed finish context', (t) => {
  collected.push(10)
  t.onTestFinished(() => {
    collected.push(12)
  })
  collected.push(11)
  expect.fail('failed')
  collected.push(null)
})

it('multiple on-finished', () => {
  onTestFinished(() => {
    multiple.push(1)
  })
  onTestFinished(() => {
    multiple.push(2)
  })
  onTestFinished(async () => {
    await new Promise(r => setTimeout(r, 100))
    multiple.push(3)
  })
  onTestFinished(() => {
    multiple.push(4)
  })
})

it('after', () => {
  expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  expect(multiple).toEqual([4, 3, 2, 1])
})

describe('repeats pass', () => {
  const state: string[] = []

  it('run', { repeats: 2 }, (t) => {
    const tag = `(${t.task.result?.retryCount}, ${t.task.result?.repeatCount}) `
    state.push(`${tag}run`)

    onTestFinished(() => {
      state.push(`${tag}finish`)
    })

    onTestFailed(() => {
      state.push(`${tag}fail`)
    })
  })

  it('assert', () => {
    expect(state).toMatchInlineSnapshot(`
      [
        "(0, 0) run",
        "(0, 0) finish",
        "(0, 1) run",
        "(0, 1) finish",
        "(0, 2) run",
        "(0, 2) finish",
      ]
    `)
  })
})

describe('repeats fail', () => {
  const state: string[] = []

  it.fails('run', { repeats: 2 }, (t) => {
    const tag = `(${t.task.result?.retryCount}, ${t.task.result?.repeatCount}) `
    state.push(`${tag}run`)

    onTestFinished(() => {
      state.push(`${tag}finish`)
    })

    onTestFailed(() => {
      state.push(`${tag}fail`)
    })

    if (t.task.result?.repeatCount === 1) {
      throw new Error('fail')
    }
  })

  it('assert', () => {
    expect(state).toMatchInlineSnapshot(`
      [
        "(0, 0) run",
        "(0, 0) finish",
        "(0, 1) run",
        "(0, 1) finish",
        "(0, 1) fail",
        "(0, 2) run",
        "(0, 2) finish",
        "(0, 2) fail",
      ]
    `)
  })
})

describe('retry pass', () => {
  const state: string[] = []

  it('run', { retry: 2 }, (t) => {
    const tag = `(${t.task.result?.retryCount}, ${t.task.result?.repeatCount}) `
    state.push(`${tag}run`)

    onTestFinished(() => {
      state.push(`${tag}finish`)
    })

    onTestFailed(() => {
      state.push(`${tag}fail`)
    })

    if (t.task.result?.retryCount && t.task.result?.retryCount > 1) {
      return
    }
    throw new Error('fail')
  })

  it('assert', () => {
    expect(state).toMatchInlineSnapshot(`
      [
        "(0, 0) run",
        "(0, 0) finish",
        "(0, 0) fail",
        "(1, 0) run",
        "(1, 0) finish",
        "(1, 0) fail",
        "(2, 0) run",
        "(2, 0) finish",
      ]
    `)
  })
})

describe('retry fail', () => {
  const state: string[] = []

  it.fails('run', { retry: 2 }, (t) => {
    const tag = `(${t.task.result?.retryCount}, ${t.task.result?.repeatCount}) `
    state.push(`${tag}run`)

    onTestFinished(() => {
      state.push(`${tag}finish`)
    })

    onTestFailed(() => {
      state.push(`${tag}fail`)
    })

    throw new Error('fail')
  })

  it('assert', () => {
    expect(state).toMatchInlineSnapshot(`
      [
        "(0, 0) run",
        "(0, 0) finish",
        "(0, 0) fail",
        "(1, 0) run",
        "(1, 0) finish",
        "(1, 0) fail",
        "(2, 0) run",
        "(2, 0) finish",
        "(2, 0) fail",
      ]
    `)
  })
})
