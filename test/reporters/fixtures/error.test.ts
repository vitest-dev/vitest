import { afterAll, it, expect } from "vitest";

afterAll(() => {
  throwSuite()
})

it('stack', () => {
  throwDeep()
})

it('diff', () => {
  expect({ hello: 'x' }).toEqual({ hello: 'y' })
})

it('unhandled', () => {
  (async () => throwSimple())()
})

it('no name object', () => {
  throw { noName: 'hi' };
});

it('string', () => {
  throw "hi";
});

it('number', () => {
  throw 1234;
});

it('number name object', () => {
  throw { name: 1234 };
});


function throwDeep() {
  throwSimple()
}

function throwSimple() {
  throw new Error('throwSimple')
}

function throwSuite() {
  throw new Error('throwSuite')
}
