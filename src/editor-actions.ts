import type { Editor } from "obsidian";

import { scanFencedBlocks } from "./fence-parser";
import type { FenceBlockRange } from "./types";

function getDeepestBlockAtLine(source: string, line: number, allowedStyleIds: ReadonlySet<string>): FenceBlockRange | null {
  const candidates = scanFencedBlocks(source).filter((block) => (
    allowedStyleIds.has(block.styleId)
    && block.openLine <= line
    && block.closeLine >= line
  ));
  return candidates.sort((left, right) => right.depth - left.depth)[0] ?? null;
}

export function canEditFenceAtCursor(editor: Editor, allowedStyleIds: ReadonlySet<string>): boolean {
  return getDeepestBlockAtLine(editor.getValue(), editor.getCursor().line, allowedStyleIds) !== null;
}

export function applyStyleToEditor(editor: Editor, styleId: string): void {
  const cursor = editor.getCursor();
  const hasSelection = editor.somethingSelected();
  let firstLine = hasSelection ? editor.getCursor("from").line : cursor.line;
  let lastLine = hasSelection ? editor.getCursor("to").line : cursor.line;

  if (hasSelection && lastLine > firstLine && editor.getCursor("to").ch === 0) {
    lastLine -= 1;
  }

  if (!hasSelection && editor.getLine(cursor.line).trim()) {
    while (firstLine > 0 && editor.getLine(firstLine - 1).trim()) {
      firstLine -= 1;
    }
    while (lastLine < editor.lineCount() - 1 && editor.getLine(lastLine + 1).trim()) {
      lastLine += 1;
    }
  }

  if (!hasSelection && !editor.getLine(cursor.line).trim()) {
    editor.replaceRange(
      `:::${styleId}\n\n:::`,
      { ch: 0, line: cursor.line },
      { ch: editor.getLine(cursor.line).length, line: cursor.line }
    );
    editor.setCursor({ ch: 0, line: cursor.line + 1 });
    return;
  }

  const content = Array.from(
    { length: lastLine - firstLine + 1 },
    (_, index) => editor.getLine(firstLine + index)
  ).join("\n");
  editor.replaceRange(
    `:::${styleId}\n${content}\n:::`,
    { ch: 0, line: firstLine },
    { ch: editor.getLine(lastLine).length, line: lastLine }
  );
  const cursorLine = firstLine + 1 + Math.max(0, cursor.line - firstLine);
  editor.setCursor({ ch: cursor.ch, line: cursorLine });
}

export function unwrapFenceAtCursor(editor: Editor, allowedStyleIds: ReadonlySet<string>): boolean {
  const source = editor.getValue();
  const cursor = editor.getCursor();
  const block = getDeepestBlockAtLine(source, cursor.line, allowedStyleIds);
  if (!block) {
    return false;
  }
  const lines = source.split("\n");
  const content = lines.slice(block.openLine + 1, block.closeLine).join("\n");
  editor.replaceRange(
    content,
    { ch: 0, line: block.openLine },
    { ch: (lines[block.closeLine] ?? "").length, line: block.closeLine }
  );
  editor.setCursor({
    ch: cursor.ch,
    line: Math.max(block.openLine, cursor.line - 1)
  });
  return true;
}

export function changeFenceStyleAtCursor(
  editor: Editor,
  styleId: string,
  allowedStyleIds: ReadonlySet<string>
): boolean {
  const source = editor.getValue();
  const block = getDeepestBlockAtLine(source, editor.getCursor().line, allowedStyleIds);
  if (!block) {
    return false;
  }
  const openingLine = editor.getLine(block.openLine);
  editor.replaceRange(
    openingLine.replace(/^([ ]{0,3}):::[a-z][a-z0-9-]*/, `$1:::${styleId}`),
    { ch: 0, line: block.openLine },
    { ch: openingLine.length, line: block.openLine }
  );
  return true;
}
