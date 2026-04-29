import { expect } from "vitest";

export function assertHelper(expected: any, actual: any) {
  try {
    expect(expected).toBe(actual);
  } catch (error: any) {
    Error.captureStackTrace(error, assertHelper);
    throw error;
  }
}

export async function assertHelperAsync(expected: any, actual: any) {
  try {
    await Promise.resolve();
    expect(expected).toBe(actual);
  } catch (error: any) {
    Error.captureStackTrace(error, assertHelperAsync);
    throw error;
  }
}

export function assertHelperBad(expected: any, actual: any) {
  expect(expected).toBe(actual);
}
