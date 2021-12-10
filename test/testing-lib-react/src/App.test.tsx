import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, clearContext, describe, expect, it } from "vitest"
import App from "./App"

beforeEach(() => clearContext())

describe("Simple working test", () => {
  it("the title is visible", async () => {
    await render(<App />)
    expect(screen.getByText(/Hello Vite \+ React!/i)).toBeTruthy()

    let button = screen.getByTestId("count-button")
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.getByText(/count is: 1/i)).toBeTruthy()
    })
  })
})
