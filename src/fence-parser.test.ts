import { describe, expect, it } from "vitest";

import {
  isLineProtected,
  parseFencedBlockNodes,
  renameFenceStyle,
  scanFencedBlocks
} from "./fence-parser";

describe("scanFencedBlocks", () => {
  it("matches a paired exact fence", () => {
    expect(scanFencedBlocks(":::definition\nA definition.\n:::")).toEqual([
      { closeLine: 2, depth: 1, openLine: 0, styleId: "definition" }
    ]);
  });

  it("supports CRLF notes without normalizing their line endings", () => {
    const source = ":::definition\r\nA definition.\r\n:::\r\n";
    expect(scanFencedBlocks(source)).toEqual([
      { closeLine: 2, depth: 1, openLine: 0, styleId: "definition" }
    ]);
    expect(renameFenceStyle(source, "definition", "term").source).toBe(
      ":::term\r\nA definition.\r\n:::\r\n"
    );
  });

  it("tracks nested fence depth", () => {
    const source = [
      ":::definition",
      "Outer",
      ":::example",
      "Inner",
      ":::",
      "Outer again",
      ":::"
    ].join("\n");
    expect(scanFencedBlocks(source)).toEqual([
      { closeLine: 6, depth: 1, openLine: 0, styleId: "definition" },
      { closeLine: 4, depth: 2, openLine: 2, styleId: "example" }
    ]);
  });

  it("ignores fences in code blocks and Obsidian comments", () => {
    const source = [
      "```markdown",
      ":::warning",
      ":::",
      "```",
      "%%",
      ":::comment",
      ":::",
      "%%",
      ":::aside",
      "Visible",
      ":::"
    ].join("\n");
    expect(scanFencedBlocks(source)).toEqual([
      { closeLine: 10, depth: 1, openLine: 8, styleId: "aside" }
    ]);
    expect(isLineProtected(source, 1)).toBe(true);
    expect(isLineProtected(source, 5)).toBe(true);
    expect(isLineProtected(source, 9)).toBe(false);
  });

  it("tracks multiline comments that start or end within ordinary lines", () => {
    const source = [
      "Visible text %% hidden from here",
      ":::warning",
      ":::",
      "still hidden %% visible again",
      ":::aside",
      "Visible",
      ":::"
    ].join("\n");
    expect(scanFencedBlocks(source)).toEqual([
      { closeLine: 6, depth: 1, openLine: 4, styleId: "aside" }
    ]);
    expect(isLineProtected(source, 1)).toBe(true);
    expect(isLineProtected(source, 4)).toBe(false);
  });

  it("leaves unmatched and malformed fences unpaired", () => {
    const source = [
      ":::Definition",
      ":::",
      "::: definition",
      ":::",
      ":::valid-but-open"
    ].join("\n");
    expect(scanFencedBlocks(source)).toEqual([]);
  });
});

describe("parseFencedBlockNodes", () => {
  it("builds nested render nodes for enabled styles", () => {
    const source = "Before\n\n:::definition\nOuter\n\n:::example\nInner\n:::\n:::";
    const nodes = parseFencedBlockNodes(source, new Set(["definition", "example"]));
    expect(nodes[0]).toMatchObject({ type: "markdown" });
    expect(nodes[1]).toMatchObject({ styleId: "definition", type: "block" });
    const outer = nodes[1];
    expect(outer?.type).toBe("block");
    if (outer?.type === "block") {
      expect(outer.children.some((node) => node.type === "block" && node.styleId === "example")).toBe(true);
    }
  });

  it("preserves an unknown outer fence and everything inside it", () => {
    const source = ":::unknown\n:::definition\nText\n:::\n:::";
    const nodes = parseFencedBlockNodes(source, new Set(["definition"]));
    expect(nodes).toEqual([{ content: `${source}\n`, type: "markdown" }]);
  });
});

describe("renameFenceStyle", () => {
  it("renames exact opening fences without touching code or similar names", () => {
    const source = [
      ":::definition",
      "Text",
      ":::",
      ":::definition-long",
      "Other",
      ":::",
      "```",
      ":::definition",
      "```"
    ].join("\n");
    const renamed = renameFenceStyle(source, "definition", "term");
    expect(renamed.count).toBe(1);
    expect(renamed.source).toContain(":::term\nText");
    expect(renamed.source).toContain(":::definition-long");
    expect(renamed.source.match(/:::definition/g)).toHaveLength(2);
  });
});
