import type { FenceBlockRange, ParsedNode } from "./types";

const OPENING_FENCE = /^ {0,3}:::([a-z][a-z0-9-]{0,39})[\t ]*\r?$/;
const CLOSING_FENCE = /^ {0,3}:::[\t ]*\r?$/;
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;

interface PendingFence {
  depth: number;
  line: number;
  styleId: string;
}

function isCodeFenceClosing(line: string, marker: string): boolean {
  const character = marker[0];
  if (!character) {
    return false;
  }
  const match = new RegExp(`^ {0,3}${character === "`" ? "`" : "~"}{${marker.length},}[\\t ]*\\r?$`).exec(line);
  return match !== null;
}

function getProcessableLines(source: string): { lines: string[]; protectedLines: Set<number> } {
  const lines = source.split("\n");
  const protectedLines = new Set<number>();
  let codeMarker = "";
  let inComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (codeMarker) {
      protectedLines.add(index);
      if (isCodeFenceClosing(line, codeMarker)) {
        codeMarker = "";
      }
      continue;
    }
    const codeMatch = CODE_FENCE.exec(line);
    if (!inComment && codeMatch?.[1]) {
      codeMarker = codeMatch[1];
      protectedLines.add(index);
      continue;
    }

    let commentDelimiter = line.indexOf("%%");
    if (inComment || commentDelimiter >= 0) {
      protectedLines.add(index);
      while (commentDelimiter >= 0) {
        inComment = !inComment;
        commentDelimiter = line.indexOf("%%", commentDelimiter + 2);
      }
    }
  }
  return { lines, protectedLines };
}

export function scanFencedBlocks(source: string): FenceBlockRange[] {
  const { lines, protectedLines } = getProcessableLines(source);
  const stack: PendingFence[] = [];
  const ranges: FenceBlockRange[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (protectedLines.has(index)) {
      continue;
    }
    const line = lines[index] ?? "";
    const opening = OPENING_FENCE.exec(line);
    if (opening?.[1]) {
      stack.push({ depth: stack.length + 1, line: index, styleId: opening[1] });
      continue;
    }
    if (CLOSING_FENCE.test(line) && stack.length > 0) {
      const pending = stack.pop();
      if (pending) {
        ranges.push({
          closeLine: index,
          depth: pending.depth,
          openLine: pending.line,
          styleId: pending.styleId
        });
      }
    }
  }

  return ranges.sort((left, right) => left.openLine - right.openLine);
}

function appendMarkdown(nodes: ParsedNode[], content: string): void {
  if (!content) {
    return;
  }
  const previous = nodes[nodes.length - 1];
  if (previous?.type === "markdown") {
    previous.content += content;
  } else {
    nodes.push({ content, type: "markdown" });
  }
}

export function parseFencedBlockNodes(source: string, allowedStyleIds: ReadonlySet<string>): ParsedNode[] {
  const lines = source.split("\n");
  const ranges = scanFencedBlocks(source);
  const byOpeningLine = new Map(ranges.map((range) => [range.openLine, range]));

  function parseRange(startLine: number, endLine: number): ParsedNode[] {
    const nodes: ParsedNode[] = [];
    let markdownStart = startLine;
    let line = startLine;
    while (line < endLine) {
      const range = byOpeningLine.get(line);
      if (!range || range.closeLine >= endLine) {
        line += 1;
        continue;
      }
      if (markdownStart < line) {
        appendMarkdown(nodes, lines.slice(markdownStart, line).join("\n") + "\n");
      }
      if (allowedStyleIds.has(range.styleId)) {
        nodes.push({
          children: parseRange(range.openLine + 1, range.closeLine),
          styleId: range.styleId,
          type: "block"
        });
      } else {
        appendMarkdown(nodes, lines.slice(range.openLine, range.closeLine + 1).join("\n") + "\n");
      }
      line = range.closeLine + 1;
      markdownStart = line;
    }
    if (markdownStart < endLine) {
      appendMarkdown(nodes, lines.slice(markdownStart, endLine).join("\n"));
    }
    return nodes;
  }

  return parseRange(0, lines.length);
}

export function renameFenceStyle(source: string, oldId: string, newId: string): { count: number; source: string } {
  const { lines, protectedLines } = getProcessableLines(source);
  let count = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (protectedLines.has(index)) {
      continue;
    }
    const line = lines[index] ?? "";
    const opening = OPENING_FENCE.exec(line);
    if (opening?.[1] === oldId) {
      lines[index] = line.replace(`:::${oldId}`, `:::${newId}`);
      count += 1;
    }
  }
  return { count, source: lines.join("\n") };
}

export function isLineProtected(source: string, lineNumber: number): boolean {
  return getProcessableLines(source).protectedLines.has(lineNumber);
}
