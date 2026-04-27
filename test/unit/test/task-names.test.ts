/**
 * This test is self-referential - it validates its own structure and the structure of the tests defined below.
 *
 * The order and nesting of these test definitions MUST match the assertions, or the test will fail. The assertions use array indices (e.g., `task.file.tasks[0]`) to access specific tests, so reordering will break the test.
 *
 * If you need to modify this structure, update both the setup below AND the corresponding assertions above to maintain consistency.
 */
import type { RunnerTestSuite } from 'vitest'
import { describe, test } from 'vitest'

test('tasks have correct `fullName` and `fullTestName` properties', ({ expect, task }) => {
  // this test validates the structure defined at the bottom of this file.
  //
  // structure (must match setup at bottom):
  //
  // task-names.test.ts
  // ├─ [0] tasks have correct `fullName` and `fullTestName` properties (this test)
  // ├─ [1] creates new recipe
  // ├─ [2] searches by ingredient
  // ├─ [3] recipe management/
  // │  ├─ [0] saves recipe
  // │  └─ [1] deletes recipe
  // └─ [4] meal planning/
  //    ├─ [0] generates weekly plan
  //    ├─ [1] grocery lists/
  //    │  ├─ [0] calculates ingredients
  //    │  ├─ [1] combines duplicate items
  //    │  └─ [2] shopping/
  //    │     ├─ [0] marks items as purchased
  //    │     └─ [1] estimates total cost
  //    ├─ [2] exports calendar
  //    └─ [3] nutrition tracking/
  //       ├─ [0] calculates daily calories
  //       └─ [1] tracks macros

  // validate this test itself (task.file.tasks[0])
  expect(task.suite).toBe(undefined)
  expect(
    task.fullName,
  ).toBe('test/task-names.test.ts > tasks have correct `fullName` and `fullTestName` properties')
  expect(
    task.fullTestName,
  ).toBe('tasks have correct `fullName` and `fullTestName` properties')

  expect(task.file.fullName).toBe('test/task-names.test.ts')
  expect(task.file.fullTestName).toBe(undefined)

  const thisTest = task.file.tasks[0]
  expect(thisTest.suite).toBe(undefined)
  expect(thisTest.fullName).toBe(
    'test/task-names.test.ts > tasks have correct `fullName` and `fullTestName` properties',
  )
  expect(thisTest.fullTestName).toBe(
    'tasks have correct `fullName` and `fullTestName` properties',
  )

  expect(
    task.file.tasks,
  ).toHaveLength(5)

  // top-level tests
  const createsRecipe = task.file.tasks[1]
  expect(createsRecipe.suite).toBe(undefined)
  expect(createsRecipe.fullName).toBe(
    'test/task-names.test.ts > creates new recipe',
  )
  expect(createsRecipe.fullTestName).toBe(
    'creates new recipe',
  )

  const searchIngredient = task.file.tasks[2]
  expect(searchIngredient.suite).toBe(undefined)
  expect(searchIngredient.fullName).toBe(
    'test/task-names.test.ts > searches by ingredient',
  )
  expect(searchIngredient.fullTestName).toBe(
    'searches by ingredient',
  )

  // single-level suite
  const recipeManagement = task.file.tasks[3] as RunnerTestSuite
  expect(recipeManagement.suite).toBe(undefined)
  expect(recipeManagement.fullName).toBe(
    'test/task-names.test.ts > recipe management',
  )
  expect(recipeManagement.fullTestName).toBe(
    'recipe management',
  )

  expect(recipeManagement.tasks).toHaveLength(2)

  const savesRecipe = recipeManagement.tasks[0]
  expect(savesRecipe.suite?.fullName).toBe(
    'test/task-names.test.ts > recipe management',
  )
  expect(savesRecipe.suite?.fullTestName).toBe(
    'recipe management',
  )
  expect(savesRecipe.fullName).toBe(
    'test/task-names.test.ts > recipe management > saves recipe',
  )
  expect(savesRecipe.fullTestName).toBe(
    'recipe management > saves recipe',
  )

  const deletesRecipe = recipeManagement.tasks[1]
  expect(deletesRecipe.suite?.fullName).toBe(
    'test/task-names.test.ts > recipe management',
  )
  expect(deletesRecipe.suite?.fullTestName).toBe(
    'recipe management',
  )
  expect(deletesRecipe.fullName).toBe(
    'test/task-names.test.ts > recipe management > deletes recipe',
  )
  expect(deletesRecipe.fullTestName).toBe(
    'recipe management > deletes recipe',
  )

  // nested suites with mixed patterns
  const mealPlanning = task.file.tasks[4] as RunnerTestSuite
  expect(mealPlanning.suite).toBe(undefined)
  expect(mealPlanning.fullName).toBe(
    'test/task-names.test.ts > meal planning',
  )
  expect(mealPlanning.fullTestName).toBe(
    'meal planning',
  )

  expect(mealPlanning.tasks).toHaveLength(4)

  const generatesPlan = mealPlanning.tasks[0]
  expect(generatesPlan.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning',
  )
  expect(generatesPlan.suite?.fullTestName).toBe(
    'meal planning',
  )
  expect(generatesPlan.fullName).toBe(
    'test/task-names.test.ts > meal planning > generates weekly plan',
  )
  expect(generatesPlan.fullTestName).toBe(
    'meal planning > generates weekly plan',
  )

  const groceryList = mealPlanning.tasks[1] as RunnerTestSuite
  expect(groceryList.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning',
  )
  expect(groceryList.suite?.fullTestName).toBe(
    'meal planning',
  )
  expect(groceryList.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists',
  )
  expect(groceryList.fullTestName).toBe(
    'meal planning > grocery lists',
  )

  expect(groceryList.tasks).toHaveLength(3)

  const calculatesIngredients = groceryList.tasks[0]
  expect(calculatesIngredients.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists',
  )
  expect(calculatesIngredients.suite?.fullTestName).toBe(
    'meal planning > grocery lists',
  )
  expect(calculatesIngredients.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > calculates ingredients',
  )
  expect(calculatesIngredients.fullTestName).toBe(
    'meal planning > grocery lists > calculates ingredients',
  )

  const combinesItems = groceryList.tasks[1]
  expect(combinesItems.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists',
  )
  expect(combinesItems.suite?.fullTestName).toBe(
    'meal planning > grocery lists',
  )
  expect(combinesItems.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > combines duplicate items',
  )
  expect(combinesItems.fullTestName).toBe(
    'meal planning > grocery lists > combines duplicate items',
  )

  const shopping = groceryList.tasks[2] as RunnerTestSuite
  expect(shopping.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists',
  )
  expect(shopping.suite?.fullTestName).toBe(
    'meal planning > grocery lists',
  )
  expect(shopping.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > shopping',
  )
  expect(shopping.fullTestName).toBe(
    'meal planning > grocery lists > shopping',
  )

  expect(shopping.tasks).toHaveLength(2)

  const marksItemsPurchased = shopping.tasks[0]
  expect(marksItemsPurchased.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > shopping',
  )
  expect(marksItemsPurchased.suite?.fullTestName).toBe(
    'meal planning > grocery lists > shopping',
  )
  expect(marksItemsPurchased.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > shopping > marks items as purchased',
  )
  expect(marksItemsPurchased.fullTestName).toBe(
    'meal planning > grocery lists > shopping > marks items as purchased',
  )

  const estimatesTotalCost = shopping.tasks[1]
  expect(estimatesTotalCost.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > shopping',
  )
  expect(estimatesTotalCost.suite?.fullTestName).toBe(
    'meal planning > grocery lists > shopping',
  )
  expect(estimatesTotalCost.fullName).toBe(
    'test/task-names.test.ts > meal planning > grocery lists > shopping > estimates total cost',
  )
  expect(estimatesTotalCost.fullTestName).toBe(
    'meal planning > grocery lists > shopping > estimates total cost',
  )

  const exportsCalendar = mealPlanning.tasks[2]
  expect(exportsCalendar.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning',
  )
  expect(exportsCalendar.suite?.fullTestName).toBe(
    'meal planning',
  )
  expect(exportsCalendar.fullName).toBe(
    'test/task-names.test.ts > meal planning > exports calendar',
  )
  expect(exportsCalendar.fullTestName).toBe(
    'meal planning > exports calendar',
  )

  const nutritionTracking = mealPlanning.tasks[3] as RunnerTestSuite
  expect(nutritionTracking.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning',
  )
  expect(nutritionTracking.suite?.fullTestName).toBe(
    'meal planning',
  )
  expect(nutritionTracking.fullName).toBe(
    'test/task-names.test.ts > meal planning > nutrition tracking',
  )
  expect(nutritionTracking.fullTestName).toBe(
    'meal planning > nutrition tracking',
  )

  expect(nutritionTracking.tasks).toHaveLength(2)

  const calculatesCalories = nutritionTracking.tasks[0]
  expect(calculatesCalories.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > nutrition tracking',
  )
  expect(calculatesCalories.suite?.fullTestName).toBe(
    'meal planning > nutrition tracking',
  )
  expect(calculatesCalories.fullName).toBe(
    'test/task-names.test.ts > meal planning > nutrition tracking > calculates daily calories',
  )
  expect(calculatesCalories.fullTestName).toBe(
    'meal planning > nutrition tracking > calculates daily calories',
  )

  const tracksMacros = nutritionTracking.tasks[1]
  expect(tracksMacros.suite?.fullName).toBe(
    'test/task-names.test.ts > meal planning > nutrition tracking',
  )
  expect(tracksMacros.suite?.fullTestName).toBe(
    'meal planning > nutrition tracking',
  )
  expect(tracksMacros.fullName).toBe(
    'test/task-names.test.ts > meal planning > nutrition tracking > tracks macros',
  )
  expect(tracksMacros.fullTestName).toBe(
    'meal planning > nutrition tracking > tracks macros',
  )
})

// setup

// top-level tests
test('creates new recipe')
test('searches by ingredient')

// single-level suite
describe('recipe management', () => {
  test('saves recipe')
  test('deletes recipe')
})

// nested suites with mixed patterns
describe('meal planning', () => {
  test('generates weekly plan')

  describe('grocery lists', () => {
    test('calculates ingredients')
    test('combines duplicate items')

    describe('shopping', () => {
      test('marks items as purchased')
      test('estimates total cost')
    })
  })

  test('exports calendar')

  describe('nutrition tracking', () => {
    test('calculates daily calories')
    test('tracks macros')
  })
})
