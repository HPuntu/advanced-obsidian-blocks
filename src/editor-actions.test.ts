import type { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  applyStyleToEditor,
  changeFenceStyleAtCursor,
  unwrapFenceAtCursor
} from "./editor-actions";

interface FakeEditor {
  cursor: EditorPosition;
  editor: Editor;
  getSource: () => string;
}

function createEditor(
  initialSource: string,
  cursor: EditorPosition,
  selection?: { from: EditorPosition; to: EditorPosition }
): FakeEditor {
  let source = initialSource;
  let currentCursor = { ...cursor };
  const getLines = (): string[] => source.split("\n");
  const toOffset = (position: EditorPosition): number => {
    const lines = getLines();
    let offset = 0;
    for (let line = 0; line < position.line; line += 1) {
      offset += (lines[line]?.length ?? 0) + 1;
    }
    return offset + position.ch;
  };

  const editor = {
    getCursor: (which?: "anchor" | "from" | "head" | "to") => {
      if (which === "from" && selection) return { ...selection.from };
      if (which === "to" && selection) return { ...selection.to };
      return { ...currentCursor };
    },
    getLine: (line: number) => getLines()[line] ?? "",
    getValue: () => source,
    lineCount: () => getLines().length,
    replaceRange: (replacement: string, from: EditorPosition, to: EditorPosition = from) => {
      source = `${source.slice(0, toOffset(from))}${replacement}${source.slice(toOffset(to))}`;
    },
    setCursor: (position: EditorPosition) => {
      currentCursor = { ...position };
    },
    somethingSelected: () => Boolean(selection)
  } as unknown as Editor;

  return {
    cursor: currentCursor,
    editor,
    getSource: () => source
  };
}

describe("applyStyleToEditor", () => {
  it("wraps the complete current paragraph", () => {
    const fake = createEditor(
      "Before\n\nCurrent one\nCurrent two\n\nAfter",
      { ch: 3, line: 3 }
    );
    applyStyleToEditor(fake.editor, "definition");
    expect(fake.getSource()).toBe(
      "Before\n\n:::definition\nCurrent one\nCurrent two\n:::\n\nAfter"
    );
  });

  it("inserts a paired skeleton on an empty line", () => {
    const fake = createEditor("Before\n\nAfter", { ch: 0, line: 1 });
    applyStyleToEditor(fake.editor, "example");
    expect(fake.getSource()).toBe("Before\n:::example\n\n:::\nAfter");
  });

  it("does not wrap the next line when a selection ends at its first character", () => {
    const fake = createEditor(
      "Alpha\nBeta\nGamma",
      { ch: 0, line: 2 },
      { from: { ch: 2, line: 0 }, to: { ch: 0, line: 2 } }
    );
    applyStyleToEditor(fake.editor, "important");
    expect(fake.getSource()).toBe(":::important\nAlpha\nBeta\n:::\nGamma");
  });
});

describe("nested editor actions", () => {
  const nested = ":::definition\nOuter\n:::example\nInner\n:::\n:::";

  it("changes the deepest block at the cursor", () => {
    const fake = createEditor(nested, { ch: 2, line: 3 });
    expect(changeFenceStyleAtCursor(
      fake.editor,
      "warning",
      new Set(["definition", "example"])
    )).toBe(true);
    expect(fake.getSource()).toContain(":::warning\nInner");
    expect(fake.getSource()).toContain(":::definition\nOuter");
  });

  it("unwraps only the deepest block at the cursor", () => {
    const fake = createEditor(nested, { ch: 2, line: 3 });
    expect(unwrapFenceAtCursor(fake.editor, new Set(["definition", "example"]))).toBe(true);
    expect(fake.getSource()).toBe(":::definition\nOuter\nInner\n:::");
  });
});
