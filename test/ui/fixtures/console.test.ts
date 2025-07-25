/* eslint-disable no-console */

import { afterAll, beforeAll, it, describe, expect } from "vitest";
import { prettyDOM } from "@testing-library/dom";

// https://github.com/vitest-dev/vitest/issues/2765
it('regexp', () => {
  console.log(/(?<char>\w)/)
})

// https://github.com/vitest-dev/vitest/issues/3934
it('html-raw', async () => {
  console.log(`
<form>
  <label for="email">Email Address</label>
  <input name="email" />
  <button>Submit</button>
</form>
`);
})

// https://github.com/vitest-dev/vitest/issues/1279
it('html-pretty', () => {
  const div = document.createElement("div");
  div.innerHTML = `
    <form>
      <label for="email">Email Address</label>
      <input name="email" />
      <button>Submit</button>
    </form>
  `.replaceAll(/\n */gm, ""); // strip new lines
  console.log(prettyDOM(div))
})


beforeAll(() => {
  console.log('beforeAll')
  console.error('beforeAll')
})

afterAll(() => {
  console.log('afterAll')
  console.error('afterAll')
})

describe('suite', () => {
  beforeAll(() => {
    console.log('beforeAll')
    console.error('beforeAll')
  })

  afterAll(() => {
    console.log('afterAll')
    console.error('afterAll')
  })

  describe('nested suite', () => {
    beforeAll(() => {
      console.log('beforeAll')
      console.error('beforeAll')
    })

    afterAll(() => {
      console.log('afterAll')
      console.error('afterAll')
    })

    it('test', () => {
      expect(true).toBe(true)
    })
  })
})
