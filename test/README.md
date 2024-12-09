Tests are split by categories. Default categories are:

## core

These tests are running in different pools with a single config file. If you just need to test a function call, you can place your test here.

This is the only test category that doesn't start new Vitest instance for every test.

## config

Place your test here if you are testing a config option.

## cli

If you are testing a complex interaction, place your tests here.

## browser

If you are testing browser mode, add your tests here.

## ui

These are e2e tests for UI package. We are using `playwright` to test it.

## watch

Place your tests here if you are testing Vitest behaviour when file is created/updated/removed.

----

All other categories just group tests by type.
