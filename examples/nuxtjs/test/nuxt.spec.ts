import { describe, expect, it } from "vitest";
import { fetch, $fetch, setup } from "@nuxt/test-utils-edge";

describe("My nuxt test", async () => {
  await setup({
    // test context options
    // https://v3.nuxtjs.org/getting-started/testing/
  });

  it("Home page respond with a correct status", async () => {
    const res = await fetch("/");
    expect(res.status).toBe(200);
  });

  it("Home page returns a correct content", async () => {
    const html = await $fetch("/");
    expect(html).toContain("<p>Hello World</p>");
  });
});
