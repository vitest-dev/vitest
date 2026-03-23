import { format } from '@vitest/pretty-format'
import { describe, expect, test } from 'vitest'

describe('maxOutputLength', () => {
  function createObjectGraph(n: number) {
    // owner
    //  |-> cats
    //       |-> cat0 -> owner
    //       |-> cat1 -> owner
    //       |-> cat2
    //       |-> ...
    //  |-> dogs
    //       |-> dog0
    //       |-> dog1
    //       |-> dog2
    //       |-> ...
    interface Owner {
      dogs: Pet[]
      cats: Pet[]
    }
    interface Pet {
      name: string
      owner: Owner
    }
    const owner: Owner = { dogs: [], cats: [] }
    for (let i = 0; i < n; i++) {
      owner.dogs.push({ name: `dog${i}`, owner })
    }
    for (let i = 0; i < n; i++) {
      owner.cats.push({ name: `cat${i}`, owner })
    }
    return owner
  }

  test('quadratic growth example depending on format root', () => {
    const owner = createObjectGraph(3)

    // when starting from owner, each pet is expanded once, so no amplification, just linear growth.
    expect(format(owner)).toMatchInlineSnapshot(`
      "Object {
        "cats": Array [
          Object {
            "name": "cat0",
            "owner": [Circular],
          },
          Object {
            "name": "cat1",
            "owner": [Circular],
          },
          Object {
            "name": "cat2",
            "owner": [Circular],
          },
        ],
        "dogs": Array [
          Object {
            "name": "dog0",
            "owner": [Circular],
          },
          Object {
            "name": "dog1",
            "owner": [Circular],
          },
          Object {
            "name": "dog2",
            "owner": [Circular],
          },
        ],
      }"
    `)

    // when starting from owner.cats, each cat re-expands the full dogs list via owner.
    // this exhibits quadratic growth, which is what the budget is designed to prevent.
    expect(format(owner.cats)).toMatchInlineSnapshot(`
      "Array [
        Object {
          "name": "cat0",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
        Object {
          "name": "cat1",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
        Object {
          "name": "cat2",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
      ]"
    `)
  })

  test('budget prevents blowup on large graphs', () => {
    // quickly hit the kill switch due to quadratic growth
    expect([10, 20, 30, 1000, 2000, 3000].map(n => format(createObjectGraph(n).cats).length))
      .toMatchInlineSnapshot(`
        [
          9729,
          36659,
          80789,
          273009,
          374009,
          299009,
        ]
      `)

    // depending on object/array shape, output can exceed the limit 1mb
    // but the output size is proportional to the amount of objects and the size of array.
    expect(format(createObjectGraph(10000).cats).length).toMatchInlineSnapshot(`999009`)
    expect(format(createObjectGraph(20000).cats).length).toMatchInlineSnapshot(`1497738`)
  })

  test('early elements expanded, later elements folded after budget trips', () => {
    // First few objects are fully expanded, but once budget is exceeded,
    // maxDepth = 0 means no more expansion.
    const arr = Array.from({ length: 10 }, (_, i) => ({ i }))
    expect(format(arr, { maxOutputLength: 100 })).toMatchInlineSnapshot(`
      "Array [
        Object {
          "i": 0,
        },
        Object {
          "i": 1,
        },
        Object {
          "i": 2,
        },
        Object {
          "i": 3,
        },
        Object {
          "i": 4,
        },
        [Object],
        [Object],
        [Object],
        [Object],
        [Object],
      ]"
    `)
  })
})
