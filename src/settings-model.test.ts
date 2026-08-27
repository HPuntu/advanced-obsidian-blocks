import { describe, expect, it } from "vitest";

import { PRESET_STYLES } from "./presets";
import {
  createCustomStyle,
  createUniqueStyleId,
  mergeImportedStyles,
  normalizeSettings,
  slugifyStyleId
} from "./settings-model";

describe("settings normalization", () => {
  it("returns independent defaults for untrusted input", () => {
    const first = normalizeSettings(null);
    const second = normalizeSettings(null);
    first.styles[0]!.name = "Changed";
    expect(second.styles[0]!.name).toBe("Definition");
  });

  it("rejects invalid IDs, duplicates, unsafe colours, and out-of-range numbers", () => {
    const settings = normalizeSettings({
      styles: [
        {
          appearance: {
            accent: { dark: "url(bad)", light: "red" },
            backgroundOpacity: 999,
            borderWidth: -20
          },
          enabled: true,
          id: "valid",
          name: "Valid"
        },
        { id: "valid", name: "Duplicate" },
        { id: "Not Valid", name: "Rejected" }
      ]
    });
    expect(settings.styles).toHaveLength(1);
    expect(settings.styles[0]!.id).toBe("valid");
    expect(settings.styles[0]!.appearance.accent).toEqual(PRESET_STYLES[0]!.appearance.accent);
    expect(settings.styles[0]!.appearance.backgroundOpacity).toBe(100);
    expect(settings.styles[0]!.appearance.borderWidth).toBe(0);
  });

  it("bounds imported style and CSS sizes", () => {
    const styles = Array.from({ length: 150 }, (_, index) => ({
      customCss: "x".repeat(10_000),
      id: `style-${index}`,
      name: "n".repeat(200)
    }));
    const settings = normalizeSettings({ styles });
    expect(settings.styles).toHaveLength(100);
    expect(settings.styles[0]!.customCss).toHaveLength(4_000);
    expect(settings.styles[0]!.name).toHaveLength(60);
  });

  it("preserves an intentionally empty style library", () => {
    expect(normalizeSettings({ styles: [] }).styles).toEqual([]);
  });
});

describe("style creation and import", () => {
  it("creates readable, unique fence names", () => {
    expect(slugifyStyleId("  Key Idea! ")).toBe("key-idea");
    expect(slugifyStyleId("123")).toBe("block-123");
    expect(createUniqueStyleId("Definition", [{ ...PRESET_STYLES[0]! }])).toBe("definition-2");
    expect(createCustomStyle("Key idea", PRESET_STYLES).id).toBe("key-idea");
  });

  it("merges imported styles by fence name", () => {
    const current = normalizeSettings(null);
    const merged = mergeImportedStyles(current, {
      styles: [{ id: "definition", name: "My definition" }, { id: "lemma", name: "Lemma" }]
    }, false);
    expect(merged.styles.find((style) => style.id === "definition")?.name).toBe("My definition");
    expect(merged.styles.some((style) => style.id === "lemma")).toBe(true);
  });

  it("rejects JSON that is not a settings export", () => {
    const current = normalizeSettings(null);
    expect(() => mergeImportedStyles(current, { unrelated: true }, false)).toThrow(TypeError);
    expect(() => mergeImportedStyles(current, ["definition"], true)).toThrow(TypeError);
  });
});
