import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";

beforeEach(() => {
  document.body.innerHTML = "";
});

test("locator.mark", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.getByRole("button").mark("button rendered");
});

test("page.mark", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.mark("button rendered");
});

test("expect.element pass", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await expect.element(page.getByRole("button")).toHaveTextContent("Hello");
});

test("expect.element fail", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.mark("button rendered");
  await expect.element(page.getByRole("button"), { timeout: 100 }).toHaveTextContent("World");
});

test("failure", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  throw new Error("Test failure");
});
