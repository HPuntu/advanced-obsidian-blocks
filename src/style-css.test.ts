import { describe, expect, it } from "vitest";

import { cloneStyle, PRESET_STYLES } from "./presets";
import { buildInlineStyle, hexToRgba, sanitizeCssDeclarations } from "./style-css";

describe("advanced CSS sanitization", () => {
  it("keeps ordinary declaration values", () => {
    expect(sanitizeCssDeclarations(
      "font-family: var(--font-text); letter-spacing: 0.01em;"
    )).toBe("font-family: var(--font-text); letter-spacing: 0.01em;");
  });

  it.each([
    "background: url(https://example.com/pixel)",
    "@import: example",
    "color: red } body { display: none",
    "width: expression(alert(1))",
    "background: javascript:alert(1)",
    "behavior: url(test.htc)",
    "-moz-binding: url(test.xml)"
  ])("rejects unsafe declaration: %s", (source) => {
    expect(sanitizeCssDeclarations(source)).toBe("");
  });

  it("discards malformed declarations while preserving safe neighbours", () => {
    expect(sanitizeCssDeclarations("not a declaration; color: #abcdef; @bad: yes"))
      .toBe("color: #abcdef;");
  });
});

describe("inline appearance properties", () => {
  it("converts theme colours to local CSS variables", () => {
    const style = cloneStyle(PRESET_STYLES[0]!);
    style.customCss = "letter-spacing: 0.01em";
    const output = buildInlineStyle(style);
    expect(output).toContain("--fenced-block-accent-light:#2f7d57");
    expect(output).toContain("letter-spacing: 0.01em");
    expect(output).not.toContain("url(");
  });

  it("converts hex and clamps opacity", () => {
    expect(hexToRgba("#ff8000", 25)).toBe("rgba(255, 128, 0, 0.25)");
    expect(hexToRgba("#000000", 200)).toBe("rgba(0, 0, 0, 1)");
  });
});
