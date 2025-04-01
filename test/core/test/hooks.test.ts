import { afterAll, afterEach, beforeAll, beforeEach, expect, it, onTestFinished, suite } from 'vitest'

let count = -1

beforeAll(() => {
  count += 1
})

beforeEach(() => {
  count += 1
})

it('one', () => {
  expect(count).toBe(1)
})

suite('level1', () => {
  it('two', () => {
    expect(count).toBe(2)
  })

  it('three', () => {
    expect(count).toBe(3)
  })

  suite('level 2', () => {
    beforeEach(() => {
      count += 1
    })

    it('five', () => {
      expect(count).toBe(5)
    })

    suite('level 3', () => {
      it('seven', () => {
        expect(count).toBe(7)
      })
    })
  })

  suite('level 2 with nested beforeAll', () => {
    beforeAll(() => {
      count = 0
    })

    it('one', () => {
      expect(count).toBe(1)
    })
  })

  it('two', () => {
    expect(count).toBe(2)
  })
})

suite('hooks cleanup', () => {
  let cleanUpCount = 0
  suite('run', () => {
    beforeAll(() => {
      cleanUpCount += 10
      return () => {
        cleanUpCount -= 10
      }
    })
    beforeEach(() => {
      cleanUpCount += 1
      return () => {
        cleanUpCount -= 1
      }
    })

    it('one', () => {
      expect(cleanUpCount).toBe(11)
    })
    it('two', () => {
      expect(cleanUpCount).toBe(11)
    })
  })
  it('end', () => {
    expect(cleanUpCount).toBe(0)
  })

  suite('do nothing when given a non-function value as cleanupCallback', () => {
    beforeAll(() => {
      return 1
    })
    beforeEach(() => {
      return null
    })
    afterAll(() => {
      return '1'
    })
    afterEach(() => {
      return {}
    })

    it('one', () => {
      expect(cleanUpCount).toBe(0)
    })
  })
  it('end', () => {
    expect(cleanUpCount).toBe(0)
  })
})

suite('hooks cleanup order', () => {
  const order: string[] = []

  beforeEach(() => {
    order.push('[a] beforeEach')
    return () => {
      order.push('[a] cleanup')
    }
  })

  beforeEach(() => {
    order.push('[b] beforeEach')
    return () => {
      order.push('[b] cleanup')
    }
  })

  it('one', () => {
    expect(order).toEqual([
      '[a] beforeEach',
      '[b] beforeEach',
    ])
  })

  afterAll(() => {
    expect(order).toEqual([
      '[a] beforeEach',
      '[b] beforeEach',
      '[b] cleanup',
      '[a] cleanup',
    ])
  })
})

suite('hooks are called for dynamically skipped tests', () => {
  const order: string[] = []

  suite('tests', () => {
    beforeEach(() => {
      order.push('beforeEach')
      return () => {
        order.push('beforeEach cleanup')
      }
    })
    afterEach(() => {
      order.push('afterEach')
    })

    beforeAll(() => {
      order.push('beforeAll')
      return () => {
        order.push('beforeAll cleanup')
      }
    })

    afterAll(() => {
      order.push('afterAll')
    })

    it('skipped', (ctx) => {
      onTestFinished(() => {
        order.push('onTestFinished')
      })
      ctx.skip()
    })
  })

  it('order is correct', () => {
    expect(order).toEqual([
      'beforeAll',
      'beforeEach',
      'afterEach',
      'beforeEach cleanup',
      'onTestFinished',
      'afterAll',
      'beforeAll cleanup',
    ])
  })
})
