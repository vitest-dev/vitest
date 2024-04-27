import { test } from 'vitest'

test('error in deps', () => {
  a()
})

function a() {
  b()
}

function b() {
  c()
}

function c() {
  d()
}

function d() {
  throw new Error('Something truly horrible has happened!')
}
