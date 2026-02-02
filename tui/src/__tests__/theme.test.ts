/**
 * Tests for components/theme.ts - color and layout constants
 */
import { describe, test, expect } from "bun:test"

import { colors, layout } from "../components/theme"

describe("colors", () => {
  test("has background colors", () => {
    expect(colors.bg).toBeTruthy()
    expect(colors.bgPanel).toBeTruthy()
    expect(colors.bgInput).toBeTruthy()
    expect(colors.bgInputFocused).toBeTruthy()
    expect(colors.bgSelected).toBeTruthy()
  })

  test("has border colors", () => {
    expect(colors.border).toBeTruthy()
    expect(colors.borderFocused).toBeTruthy()
    expect(colors.borderSuccess).toBeTruthy()
    expect(colors.borderError).toBeTruthy()
    expect(colors.borderWarning).toBeTruthy()
  })

  test("has text colors", () => {
    expect(colors.text).toBeTruthy()
    expect(colors.textDim).toBeTruthy()
    expect(colors.textBright).toBeTruthy()
    expect(colors.textCyan).toBeTruthy()
    expect(colors.textGreen).toBeTruthy()
    expect(colors.textYellow).toBeTruthy()
    expect(colors.textBlue).toBeTruthy()
    expect(colors.textMagenta).toBeTruthy()
    expect(colors.textRed).toBeTruthy()
    expect(colors.textOrange).toBeTruthy()
  })

  test("has header/footer colors", () => {
    expect(colors.headerBg).toBeTruthy()
    expect(colors.headerBorder).toBeTruthy()
    expect(colors.footerBg).toBeTruthy()
    expect(colors.footerBorder).toBeTruthy()
  })

  test("has accent colors", () => {
    expect(colors.accent).toBeTruthy()
    expect(colors.accentGreen).toBeTruthy()
    expect(colors.accentYellow).toBeTruthy()
    expect(colors.accentPurple).toBeTruthy()
  })

  test("all colors are hex strings", () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe("layout", () => {
  test("has headerHeight", () => {
    expect(layout.headerHeight).toBe(3)
  })

  test("has footerHeight", () => {
    expect(layout.footerHeight).toBe(3)
  })

  test("has panelPadding", () => {
    expect(layout.panelPadding).toBe(1)
  })

  test("has gap", () => {
    expect(layout.gap).toBe(1)
  })
})
