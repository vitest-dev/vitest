docs/.vitepress/config.ts

@@ -489,6 +489,10 @@ function guide(): DefaultTheme.SidebarItem[] {
      text: 'Test Projects',
      link: '/guide/projects',
    },
    {

Comment :
 sheremet-va 1 hour ago

From #8409 (comment)

This should be in the browser guides section (in the same level as "Multiple Setups")

--------------
docs/guide/component-testing.md

### Component Testing Hierarchy

```
1. Critical User Paths    → Always test these

Comment:
 sheremet-va 1 hour ago

should the spaces be aligned? The first 2 arrows are not aligned
-----------------------
docs/guide/component-testing.md

```tsx
// Mock external services
vi.mock('../api/userService', () => ({

Comment:
 sheremet-va 1 hour ago
we recommend vi.mock(import('../api/userService')) syntax (applied to all vi.mock calls here)
--------------------------
docs/guide/component-testing.md

expect(getByText('Loading...')).toBeInTheDocument()

  // Wait for data to load
  await waitFor(() => {

Comment:
 sheremet-va 1 hour ago
There is await expect.element(locator).toBeInTheDocument()

---------------------
docs/guide/component-testing.md

  )

  // Initially shows all products
  expect(getByText('Laptop')).toBeInTheDocument()

  Comment:
   sheremet-va 1 hour ago

We recommend all expect(locator) to be expect.element(locator)

-------------------------
docs/guide/component-testing.md

  const screen = page.elementLocator(baseElement)

  // You can use either Testing Library queries or Vitest's page queries
  const incrementButton = getByRole('button', { name: /increment/i })

  Comment:
   sheremet-va 1 hour ago
  I don't think we should introduce this confusion. Don't use testing-libraries' getBy* methods anywhere

  ----------------------------
  docs/guide/component-testing.md

  expect(document.activeElement).toBe(nextFocusableElement)

// Test ARIA attributes
expect(modal).toHaveAttribute('aria-modal', 'true')

Comment:
 sheremet-va 1 hour ago
we recommend await expect.element(el).toHaveAttribute() (notice await) because it auto-retries the assertion
--------------------------
docs/guide/component-testing.md

```tsx
// Mock API calls
vi.mock('../api/userService', () => ({

Comment :
 sheremet-va 1 hour ago

For APIs we recommend msw (you can link /guide/mocking/requests)

---------------------------
docs/guide/component-testing.md

```tsx
// Mock the API to test different scenarios
const mockUserApi = vi.fn()
vi.mock('../api/users', () => ({ getUser: mockUserApi }))

Comment:
 sheremet-va 1 hour ago
This code doesn't work, it will throw ReferenceError. Requests examples should use msw

-----------------
docs/guide/component-testing.md

mockUserApi.mockResolvedValue({ name: 'John Doe', email: 'john@example.com' })
  rerender(<UserProfile userId="123" />)

  await waitFor(() => {

Comment:
 sheremet-va 1 hour ago

do not use waitFor anywhere. Vitest supports auto-retrying via expect.element

------------------------
docs/guide/component-testing.md

 await expect.element(getByText('Please enter a valid email')).toBeInTheDocument()

  // Test successful submission
  await emailInput.clear()

Comment:
 sheremet-va 1 hour ago
fill already does the clear so it's redundant

-------------------
docs/guide/component-testing.md

  const firstInput = getByLabelText(/username/i)
  const lastButton = getByRole('button', { name: /save/i })

  firstInput.focus()

  Comment:
   sheremet-va 1 hour ago
  Vitest doesn't have a focus method - I already mentioned it before: #8409 (comment)

  ------------------------
  docs/guide/component-testing.md

    firstInput.focus()
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}') // Shift+Tab goes backwards
  expect(document.activeElement).toBe(lastButton) // Should wrap to last element

  Comment:
   sheremet-va 1 hour ago
await expect.element

-----------------------
docs/guide/component-testing.md

- **Check console errors** for JavaScript errors or warnings
- **Monitor network requests** to debug API calls

For headless mode debugging, add `headless: false` to your browser config temporarily.

Comment:
 sheremet-va 1 hour ago

    For headless mode debugging

for non-headless or headful

it can't be headless if you set headless: false

--------------------------
docs/guide/component-testing.md

  // Debug: Check if element exists with different query
  const errorElement = page.getByText('Email is required')
  console.log('Error element found:', await errorElement.count())

  Comment :
   sheremet-va 1 hour ago

vitest doesn't have a count, we do have length though

-------------------------
docs/guide/component-testing.md

```tsx
// Debug why elements can't be found
const button = page.getByRole('button', { name: /submit/i })
console.log('Button count:', await button.count()) // Should be 1

Comment:
 sheremet-va 1 hour ago
no count

-------------------------
docs/guide/component-testing.md

// Try alternative queries if the first one fails
if (await button.count() === 0) {
  console.log('All buttons:', await page.getByRole('button').all())

Comment:
 sheremet-va 1 hour ago

all is not async

-----------------------
docs/guide/component-testing.md
// If getByRole fails, check what roles/names are available
const buttons = await page.getByRole('button').all()
for (const button of buttons) {
  const accessibleName = await button.getAttribute('aria-label')

Comment:
 sheremet-va 1 hour ago

there is no getAttribute

-----------------------------
docs/guide/component-testing.md

const buttons = await page.getByRole('button').all()
for (const button of buttons) {
  const accessibleName = await button.getAttribute('aria-label')
    || await button.textContent()

Comment:
 sheremet-va 1 hour ago

there is no textContent

---------------------------
docs/guide/component-testing.md

const submitButton
  = page.getByRole('button', { name: /submit/i }) // By accessible name
    || page.getByTestId('submit-button') // By test ID
    || page.locator('button[type="submit"]') // By CSS selector

Comment:
 sheremet-va 1 hour ago

there is no locator

---------------------
docs/guide/component-testing.md

  // 3. Check if element is hidden or disabled
  if (await emailInput.count() > 0) {
    console.log('Email input visible:', await emailInput.isVisible())

 sheremet-va 1 hour ago

there is no isVisible

Note For you:
Always ensure that the methods exists in the library. Verify if you are unsure either within the repo or going online or ask me if you have any questions

Comment I shared for you
I have put up all the reviews we got from @sheremet-va today . Here is the link to the file => /Users/cr7/Documents/review.md and there is note for you at the end of the markdown. Please ensure that you follow the notes. You need to fix each of the reviews one by one then you also have to provide me with the thoughtful response for @sheremet-va for each of the reviews.

---

## CURRENT STATUS & TODO LIST

### ✅ **Already Fixed (3/17 items):**
1. **Hierarchy alignment** - Fixed arrow alignment in Component Testing Hierarchy
2. **vi.mock syntax** - Updated to use `vi.mock(import('...'))` syntax throughout
3. **MSW recommendation** - Added recommendation to use MSW for API mocking with link to `/guide/mocking/requests`

### 🚧 **High Priority - API Issues (Need Immediate Fix):**
4. **Move component testing to browser guides section** - Config.ts placement issue
5. **Replace expect() with expect.element()** - Line 41 & 56 + multiple other instances
6. **Remove Testing Library getBy* confusion** - Line 69 - causes confusion with Vitest APIs
7. **Add await to expect.element assertions** - Line 78 - for auto-retry functionality
8. **Remove waitFor usage** - Line 116 - replace with expect.element auto-retry
9. **Remove redundant clear() call** - Line 129 - fill() already clears
10. **Fix focus method issue** - Line 141 - Vitest doesn't have focus method
11. **Fix headless debugging text** - Line 164 - terminology correction
12. **Replace count() with length** - Line 181, 194, 204 - count() doesn't exist in Vitest
13. **Fix all() method usage** - Line 205, 215 - all() is not async
14. **Replace getAttribute method** - Line 217 - doesn't exist in Vitest
15. **Replace textContent method** - Line 230 - doesn't exist in Vitest
16. **Replace locator method** - Line 241 - doesn't exist in Vitest
17. **Replace isVisible method** - Line 256 - doesn't exist in Vitest

### 📝 **Next Steps:**
1. Fix each issue systematically (one by one as requested)
2. Prepare thoughtful response for each review comment to @sheremet-va
3. Verify all API methods exist in Vitest browser mode documentation
4. Test examples to ensure they work with actual Vitest APIs

### 🎯 **Root Cause Analysis:**
The guide appears to have been written using Playwright/Testing Library APIs instead of the actual Vitest browser mode APIs. Many method names and patterns need to be corrected to match Vitest's implementation.

**Status as of:** September 3, 2025 11:41 AM
**Completion:** 3/17 issues resolved (17.6%)
