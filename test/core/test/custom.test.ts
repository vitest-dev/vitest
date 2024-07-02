import { createChainable, getCurrentSuite } from 'vitest/suite'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import { Gardener } from '../src/custom/gardener.js'

// this function will be called, when Vitest collects tasks
const myCustomTask = createChainable(['todo'], function (name: string, fn: () => void) {
  getCurrentSuite().task(name, {
    ...this,
    meta: {
      customPropertyToDifferentiateTask: true,
    },
    handler: fn,
  })
})

const gardener = new Gardener()

describe('take care of the garden', () => {
  beforeAll(() => {
    gardener.putWorkingClothes()
  })

  beforeEach(() => {
    gardener.standup()
  })

  afterEach(() => {
    gardener.rest()
  })

  myCustomTask('weed the grass', () => {
    gardener.weedTheGrass()
  })
  myCustomTask.todo('mow the lawn', () => {
    gardener.mowerTheLawn()
  })
  myCustomTask('water flowers', () => {
    gardener.waterFlowers()
  })

  afterAll(() => {
    gardener.goHome()
  })
})

test('states are filled correctly', () => {
  expect(gardener.states).toEqual([
    'wake up',
    'working clothes',
    'standup',
    'weed the grass',
    'rest',
    'standup',
    'water flowers',
    'rest',
    'home',
  ])
})
