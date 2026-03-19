import { format, plugins } from '@vitest/pretty-format'
import { describe, expect, it } from 'vitest'

describe('circular reference formatting', () => {
  it('prints [circular ClassName] for circular object references', () => {
    class Game {
      roomItems: any[] = []
    }
    class RoomItem {
      game: any
      constructor(game: any) {
        this.game = game
      }
    }

    const game = new Game()
    const item = new RoomItem(game)
    game.roomItems.push(item)

    expect(format(item)).toMatchInlineSnapshot(`
      "RoomItem {
        "game": Game {
          "roomItems": Array [
            [circular RoomItem],
          ],
        },
      }"
    `)
  })

  it('prints [circular ClassName] for self-referencing objects', () => {
    class Node {
      next: any = null
      value: number
      constructor(value: number) {
        this.value = value
      }
    }

    const node = new Node(1)
    node.next = node

    expect(format(node)).toMatchInlineSnapshot(`
      "Node {
        "next": [circular Node],
        "value": 1,
      }"
    `)
  })

  it('prints [circular Object] for plain objects with circular refs', () => {
    const obj: any = { a: 1 }
    obj.self = obj

    expect(format(obj)).toMatchInlineSnapshot(`
      "Object {
        "a": 1,
        "self": [circular Object],
      }"
    `)
  })

  it('prints [circular ErrorName] for circular Error references (with Error plugin)', () => {
    const err1 = new Error('first')
    const err2 = new Error('second')
    ;(err1 as any).cause = err2
    ;(err2 as any).cause = err1

    expect(format(err1, { plugins: [plugins.Error] })).toMatchInlineSnapshot(`
      "Error {
        "message": "first",
        "cause": Error {
          "message": "second",
          "cause": [circular Error],
        },
      }"
    `)
  })
})
