---
title: How Browser Mode Works | Browser Mode
outline: deep
---

# How Browser Mode Works

## Why Is This Important To Read

This article explains the architecture, internals, and workflow of Vitest's Browser Mode. Whether you're a user wanting to understand how your tests execute or a contributor diving into the codebase, this guide covers both high-level concepts and technical details

## The Philosophy

## The key players

- **The Node.js process** -  is where the CLI is being invoked, doing common setup tasks like filtering test files and then it orchestrates a pool of test processors where the actual execution happens

- The provider responsible to instantiate and interact with a real browser using some specific technology like Playwright WebDriver I/O, or any custom future implementation. This is configurable for the sake of simplicity, the rest of this guide assumes a Playwright usage, but most of the concepts apply to every provider.

- The tester page HTML page that is being rendered inside the browser that was created with the provider and allows putting the code under test inside along with other Vitest utilities to execute a code as explained in the next line

- Iframe & the test runner - an iframe is being placed inside a page, and this is where we're about to execute the test and render the component. This is also meant for isolation, which is explained below in the section on Parallelization and Isolation. Inside the iframe, the test runner is being kicked off. - Whether Vanilla Vitest or Browser Mod. This code simply goes through all the test files and the test functions and executes the code inside to generate a success/failure report in the end. As part of the test execution it also renders components inside that view

- The orchestrator given the Node.js process which is the main coordinator and has full permissions and access in the tester page. There is a need to orchestrate messages and actions between the test runner and the Node.js process. See the next paragraph for a basic flow that makes the point why it is required.

## A Basic Flow

### Initializing A Test Flow

There is an attached image here which shows one how the main thread worker pool opens the browser first using one of the providers (in this example, let's play right then). It asks to render the tester page which embodies the test orchestrator and a test runner inside an iframe. Then the main thread asked the orchestrator to start running some test suite. The orchestrator asks the test runner to run this file which processes each and every test, executes it, if there is a render, it will render it inside an anchor that is placed in the page, and finally reports failure or success back to the main thread using the orchestrator

(image in /docs/public/vitest-browser-initializing-test-suite.png)

### A Typical Action Flow

In the image, we can see:
1. When there is a user event in a test (like a click), the test runner would like to perform a realistic event using the lowest browser driver that is available.
2. But it has no permission access to the browser's low-level API, so it approaches using a WebSocket message.
3. The main thread sends a command to the provider (in this example, it's Playwright).
4. The provider sends a CDB message (or a WebDriver message if it's WebDriver IO) to the browser, and this makes it a realistic event that is very close to how a user click happens in a production environment.

(image in /docs/public/vitest-browser-typical-action.png)

## Mocking Code And Network Calls

### Mocking code

Explain here the flow of a typical mocking first say that Vitest, unlike many others end-to-end solutions, aims to serve more as a component or page testing. In this environment, it's quite typical that, although it's not ideal and usually mocking trying to be reduced, sometimes it is needed. Here is a typical mocking flow when a test is using VI.mock or any other test doubles instruction. Vitest will hoist this instruction at the beginning of the file, and then, when the page loads, it first always first parses the test file and note the request to replace some module. This happens first because that mocking statement was placed at the beginning of the test. Then, after, when the code under test (e.g., a front-end page) tries to reach the origin module, the ones that was mocked, Vitest realizes this and since it was kept in its mocking registry, it knows to serve a mocked module (the ones that was defined in the test)

Explain here, why Playwright network interceptor page.trout is being used to serve the mocked model.

### Network code

It's quite common to also mock or shall we say intercept, network requests. In some testing strategies, it is even encouraged. How can this be achieved? The thing about the browser mode is that the code is actually executed inside a browser, so any capability that was available in a browser environment is still available for your tests. Any technique or library that was useful in your unit test or component test with JSDOM, for example, can still be reused in this environment. That is to say, you can use any of the popular libraries that allow mocking network requests like MSW (put link) and others

## Parallelization And Isolation

When dealing with real browsers and tests that have a significant footprint, there is always the trade-off between performance and safety. Isolating each and every test with a unique browser can have an unbearable performance impact. On the other side of the spectrum, running multiple tests at a time over the same view is likely to introduce collisions. Finding the sweet spot for your specific case is the drill here. Let's understand some basic mechanics first.

## The file level

For a start, before all test files are executed, a new browser context is created which is similar to a new incognito mode. In other words, a bunch of test files that are executed in a single worker process starts from a clean browser state. Then, by default, each file (a test suite) gets a fresh new iframe to run in, so it can be isolated from previously run test suites. If you wish to change this, you may set browser.isolate to false - this will show a performance gain but might make test suites step on each other's toes.

By default, the various test files will be executed sequentially, one after the other, and not concurrently. While this reduces performance significantly, it provides better isolation, so each test file can assume no other tests executed at the same time in the same browser. Though this is and one may set browser.fileParallelism=true, this is a true risk that puts the test at a state where various actions might leak between various iframes. We should explain here also that parallelism means that multiple iframes would be created in the same browser.

A quote from the official config docs: "This makes it impossible to use interactive APIs (like clicking or hovering) because there are several iframes on the screen at the same time, but if your tests don't rely on those APIs, it might be much faster to just run all of them at the same time"

## The test level

By design, inside a test file, tests are not isolated at all which means that after one test is done, the next one will be executed over the same iframe and might share the same globals, CSS name space, event listener central. It's the application-level responsibility to decide whether this is an issue. If it is, to clean up on the app level and/or use test runner cleanups like mock resets
