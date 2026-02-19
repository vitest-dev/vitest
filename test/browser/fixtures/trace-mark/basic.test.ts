import { beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

beforeEach(() => {
  document.body.innerHTML = "";
});

test("locator.mark", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.getByRole("button").mark("button rendered - locator");
});

test("page.mark", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.mark("button rendered - page");
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

test("click", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  await page.getByRole("button").click();
});

const myRender = vi.defineHelper(async (content: string) => {
  document.body.innerHTML = content;
  await  page.elementLocator(document.body).mark("render helper");
});

test("helper", async () => {
  await myRender("<button>Hello</button>");
});

test("stack", async () => {
  document.body.innerHTML = "<button>Hello</button>";
  const error = new Error("Custom error for stack trace");
  await page.getByRole("button").mark("button rendered - stack", { stack: error.stack });
});
