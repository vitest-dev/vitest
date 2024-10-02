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

  it('run', { repeats: 2 }, () => {
    state.push('run')

    onTestFinished(() => {
      state.push('finish')
    })

    onTestFailed(() => {
      state.push('fail')
    })
  })

  it('assert', () => {
    // TODO: 010101
    expect(state).toMatchInlineSnapshot(`
      [
        "run",
        "finish",
        "run",
        "finish",
        "finish",
        "run",
        "finish",
        "finish",
        "finish",
      ]
    `)
  })
})

describe('repeats fail', () => {
  const state: string[] = []

  it.fails('run', { repeats: 2 }, (t) => {
    state.push('run')

    onTestFinished(() => {
      state.push('finish')
    })

    onTestFailed(() => {
      state.push('fail')
    })

    if (t.task.result?.repeatCount === 1) {
      throw new Error('fail')
    }
  })

  it('assert', () => {
    // TODO: 012012012
    expect(state).toMatchInlineSnapshot(`
      [
        "run",
        "finish",
        "run",
        "finish",
        "finish",
        "fail",
        "fail",
        "run",
        "finish",
        "finish",
        "finish",
        "fail",
        "fail",
        "fail",
      ]
    `)
  })
})

describe('retry pass', () => {
  const state: string[] = []

  it('run', { retry: 2 }, (t) => {
    state.push('run')

    onTestFinished(() => {
      state.push('finish')
    })

    onTestFailed(() => {
      state.push('fail')
    })

    if (t.task.result?.retryCount && t.task.result?.retryCount > 1) {
      return
    }
    throw new Error('fail')
  })

  it('assert', () => {
    // TODO: 01201201
    expect(state).toMatchInlineSnapshot(`
      [
        "run",
        "finish",
        "fail",
        "run",
        "finish",
        "finish",
        "fail",
        "fail",
        "run",
        "finish",
        "finish",
        "finish",
      ]
    `)
  })
})

describe('retry fail', () => {
  const state: string[] = []

  it.fails('run', { retry: 2 }, () => {
    state.push('run')

    onTestFinished(() => {
      state.push('finish')
    })

    onTestFailed(() => {
      state.push('fail')
    })

    throw new Error('fail')
  })

  it('assert', () => {
    // TODO: 012012012
    expect(state).toMatchInlineSnapshot(`
      [
        "run",
        "finish",
        "fail",
        "run",
        "finish",
        "finish",
        "fail",
        "fail",
        "run",
        "finish",
        "finish",
        "finish",
        "fail",
        "fail",
        "fail",
      ]
    `)
  })
})
