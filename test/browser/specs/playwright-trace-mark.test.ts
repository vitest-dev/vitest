import { createRequire } from "node:module";
import { readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "pathe";
import { afterEach, describe, expect, test } from "vitest";
import { instances, provider, runBrowserTests } from "./utils";
import { buildTestProjectTree } from "../../test-utils";
import { stripVTControlCharacters } from "node:util";
import path from "node:path";

type TraceBeforeEvent = {
  type: "before";
  callId: string;
  class: string;
  method: string;
  title?: string;
  stack?: { file: string }[];
};

type TraceAfterEvent = {
  type: "after";
  callId: string;
};

type TraceEvent = TraceBeforeEvent | TraceAfterEvent | { type: string };

type ZipFileType = {
  entries: () => Promise<string[]>;
  read: (entryPath: string) => Promise<Buffer>;
  close: () => void;
};

const require = createRequire(import.meta.url);
const playwrightEntry = require.resolve("playwright");
const zipFileEntry = resolve(
  dirname(playwrightEntry),
  "../playwright-core/lib/server/utils/zipFile.js",
);
const { ZipFile } = require(zipFileEntry) as { ZipFile: new (fileName: string) => ZipFileType };

const tracesFolder = resolve(import.meta.dirname, "../fixtures/trace-mark/__traces__");
const basicTestTracesFolder = resolve(tracesFolder, "basic.test.ts");

describe.runIf(provider.name === "playwright")("playwright trace marks", () => {
  afterEach(() => {
    rmSync(tracesFolder, { recursive: true, force: true });
  });

  test("vitest mark is present in zipped trace events", async () => {
    const { results, ctx } = await runBrowserTests({
      root: "./fixtures/trace-mark",
      browser: {
        trace: {
          mode: "on",
          screenshots: false, // makes it lighter
        },
      },
    });
    const projectTree = buildTestProjectTree(results, (testCase) => {
      const result = testCase.result();
      return result.state === "failed"
        ? result.errors.map((e) => stripVTControlCharacters(e.message))
        : result.state;
    });
    expect(Object.keys(projectTree).sort()).toEqual(instances.map((i) => i.browser).sort());

    for (const [name, tree] of Object.entries(projectTree)) {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "click": "passed",
            "expect.element fail": [
              "expect(element).toHaveTextContent()

        Expected element to have text content:
          World
        Received:
          Hello",
            ],
            "expect.element pass": "passed",
            "failure": [
              "Test failure",
            ],
            "locator.mark": "passed",
            "page.mark": "passed",
          },
        }
      `);

      const traceFiles = readdirSync(basicTestTracesFolder)
        .filter((file) => file.startsWith(`${name}-`) && file.endsWith(".trace.zip"))
        .sort();
      expect(traceFiles).toEqual([
        expect.stringContaining("click"),
        expect.stringContaining("expect-element-fail"),
        expect.stringContaining("expect-element-pass"),
        expect.stringContaining("failure"),
        expect.stringContaining("locator-mark"),
        expect.stringContaining("page-mark"),
      ]);

      for (const traceFile of traceFiles) {
        const zipPath = resolve(basicTestTracesFolder, traceFile);
        const parsed = await readTraceZip(zipPath);
        const events: any[] = parsed.events.filter((event: any) => event.type === "before");

        if (traceFile.includes("locator-mark")) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: "tracingGroup",
                title: "button rendered - locator",
              }),
              expect.objectContaining({
                method: "expect",
                params: expect.objectContaining({
                  selector:
                    '[data-vitest="true"] >> internal:control=enter-frame >> internal:role=button',
                }),
              }),
            ]),
          );
          const frame = events.find(e => e.title === 'button rendered - locator')?.stack?.[0];
          frame.file = path.relative(ctx.config.root, frame.file);
          expect(frame).toMatchInlineSnapshot(`
            {
              "column": 33,
              "file": "basic.test.ts",
              "line": 10,
            }
          `);
        }

        // if (traceFile.includes("page-mark")) {
        //   const marker = events.find((event) => event.title === "button rendered");
        //   expect(marker).toBeDefined();
        //   expect(["tracingGroup", "tracingMark"]).toContain(marker!.method);
        //   expect(hasAfterEvent(events, marker!.callId)).toBe(true);
        //   expect(hasTestFileStack(marker!, "trace-mark/basic.test.ts")).toBe(true);
        // }

        // if (traceFile.includes("expect-element-pass")) {
        //   const marker = events.find((event) => {
        //     return event.title?.startsWith("expect.element().toHaveTextContent");
        //   });
        //   expect(marker).toBeDefined();
        //   expect(marker!.title).not.toContain("[ERROR]");
        //   expect(hasAfterEvent(events, marker!.callId)).toBe(true);
        //   expect(hasTestFileStack(marker!, "trace-mark/basic.test.ts")).toBe(true);
        // }
        // if (traceFile.includes("expect-element-fail")) {
        //   const marker = events.find((event) => {
        //     return (
        //       event.title?.startsWith("expect.element().toHaveTextContent") &&
        //       event.title.includes("[ERROR]")
        //     );
        //   });
        //   expect(marker).toBeDefined();
        //   expect(hasAfterEvent(events, marker!.callId)).toBe(true);
        //   expect(hasTestFileStack(marker!, "trace-mark/basic.test.ts")).toBe(true);

        //   const explicitMark = events.find((event) => event.title === "button rendered");
        //   expect(explicitMark).toBeDefined();
        // }

        // if (traceFile.includes("failure")) {
        //   const userMarkers = events.filter((event) => {
        //     return (
        //       event.title === "button rendered" ||
        //       event.title?.startsWith("expect.element().toHaveTextContent")
        //     );
        //   });
        //   expect(userMarkers).toEqual([]);
        // }

        // if (traceFile.includes("click")) {
        //   const userMarkers = events.filter((event) => {
        //     return (
        //       event.title === "button rendered" ||
        //       event.title?.startsWith("expect.element().toHaveTextContent")
        //     );
        //   });
        //   expect(userMarkers).toEqual([]);
        // }
      }
    }
  });
});

async function readTraceZip(zipPath: string): Promise<{ entries: string[]; events: TraceEvent[] }> {
  const zipFile = new ZipFile(zipPath);
  try {
    const entries = await zipFile.entries();
    const traceText = (await zipFile.read("trace.trace")).toString("utf-8");
    const events = traceText
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        return JSON.parse(line) as TraceEvent;
      });
    return { entries, events };
  } finally {
    zipFile.close();
  }
}

// function hasAfterEvent(events: TraceEvent[], callId: string): boolean {
//   return events.some((event): event is TraceAfterEvent => {
//     return event.type === "after" && event.callId === callId;
//   });
// }

// function hasTestFileStack(event: TraceBeforeEvent, fileSuffix: string): boolean {
//   return (event.stack || []).some((frame) => {
//     return frame.file.replaceAll("\\", "/").endsWith(fileSuffix);
//   });
// }
