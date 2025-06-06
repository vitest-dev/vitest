import {expect, test } from 'vitest';

test('pass', ( { task }) => {
  task.meta.custom = "Passing test added this"
});


test('fails', ( { task }) => {
  task.meta.custom = "Failing test added this"

  expect(true).toBe(false)
});
