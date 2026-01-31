/**
 * Shared color theme and styling constants for the TUI app.
 */

export const colors = {
  // Backgrounds
  bg: "#0a0e17",
  bgPanel: "#111827",
  bgInput: "#1e293b",
  bgInputFocused: "#334155",
  bgSelected: "#3b82f6",
  bgSuccess: "#059669",
  bgError: "#dc2626",
  bgWarning: "#d97706",

  // Borders
  border: "#374151",
  borderFocused: "#3b82f6",
  borderSuccess: "#10b981",
  borderError: "#ef4444",
  borderWarning: "#f59e0b",

  // Text
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f8fafc",
  textCyan: "#22d3ee",
  textGreen: "#34d399",
  textYellow: "#fbbf24",
  textBlue: "#60a5fa",
  textMagenta: "#c084fc",
  textRed: "#f87171",
  textOrange: "#fb923c",

  // Header/Footer
  headerBg: "#1e40af",
  headerBorder: "#1d4ed8",
  footerBg: "#0f172a",
  footerBorder: "#1e293b",

  // Accents
  accent: "#3b82f6",
  accentGreen: "#059669",
  accentYellow: "#eab308",
  accentPurple: "#8b5cf6",
} as const

export const layout = {
  headerHeight: 3,
  footerHeight: 3,
  panelPadding: 1,
  gap: 1,
} as const
