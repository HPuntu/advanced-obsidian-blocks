import {
  MarkdownRenderChild,
  MarkdownRenderer,
  type App,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext,
  TFile
} from "obsidian";

import { parseFencedBlockNodes, scanFencedBlocks } from "./fence-parser";
import { applyStyleProperties } from "./style-css";
import type { BlockStyle, FenceBlockRange, FencedBlocksSettings, ParsedNode } from "./types";

interface CachedSource {
  modified: number;
  ranges: FenceBlockRange[];
  source: string;
}

async function renderNodes(
  app: App,
  nodes: readonly ParsedNode[],
  container: HTMLElement,
  sourcePath: string,
  child: MarkdownRenderChild,
  stylesById: ReadonlyMap<string, BlockStyle>
): Promise<void> {
  for (const node of nodes) {
    if (node.type === "markdown") {
      if (node.content.trim()) {
        const markdownContainer = container.createDiv({ cls: "fenced-block-markdown" });
        await MarkdownRenderer.render(app, node.content, markdownContainer, sourcePath, child);
      }
      continue;
    }
    const style = stylesById.get(node.styleId);
    if (!style) {
      continue;
    }
    const block = container.createDiv({ cls: "fenced-block" });
    block.dataset.fencedBlockBorder = style.appearance.borderPlacement;
    block.dataset.fencedBlockStyle = style.id;
    block.dataset.fencedBlockName = style.name;
    applyStyleProperties(block, style);
    if (style.showLabel) {
      block.createDiv({ cls: "fenced-block__label", text: style.name });
    }
    const content = block.createDiv({ cls: "fenced-block__content" });
    await renderNodes(app, node.children, content, sourcePath, child, stylesById);
  }
}

export function createReadingViewProcessor(
  app: App,
  getSettings: () => FencedBlocksSettings
): MarkdownPostProcessor {
  const sourceCache = new Map<string, CachedSource>();

  async function getCompleteSource(context: MarkdownPostProcessorContext): Promise<CachedSource | null> {
    const file = app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      return null;
    }
    const cached = sourceCache.get(file.path);
    if (cached?.modified === file.stat.mtime) {
      sourceCache.delete(file.path);
      sourceCache.set(file.path, cached);
      return cached;
    }
    const source = await app.vault.cachedRead(file);
    const entry = { modified: file.stat.mtime, ranges: scanFencedBlocks(source), source };
    sourceCache.set(file.path, entry);
    if (sourceCache.size > 32) {
      const oldestPath = sourceCache.keys().next().value;
      if (oldestPath) {
        sourceCache.delete(oldestPath);
      }
    }
    return entry;
  }

  return async (element: HTMLElement, context: MarkdownPostProcessorContext): Promise<void> => {
    const settings = getSettings();
    if (!settings.readingView || element.closest(".fenced-blocks-rendered")) {
      return;
    }
    const section = context.getSectionInfo(element);
    if (!section?.text) {
      return;
    }
    const enabledStyles = settings.styles.filter((style) => style.enabled);
    const allowedStyleIds = new Set(enabledStyles.map((style) => style.id));
    const complete = await getCompleteSource(context);
    const source = complete?.source ?? section.text;
    const ranges = complete?.ranges ?? scanFencedBlocks(source);
    const roots = getRenderableRoots(ranges, allowedStyleIds);
    const sectionStart = complete ? Math.max(0, section.lineStart) : 0;
    const sectionEnd = complete ? Math.max(sectionStart, section.lineEnd) : source.split("\n").length - 1;
    if (!roots.some((range) => range.openLine <= sectionEnd && range.closeLine >= sectionStart)) {
      return;
    }

    const sectionSource = complete
      ? buildSectionSource(source, sectionStart, sectionEnd, roots)
      : source;
    const nodes = parseFencedBlockNodes(sectionSource, allowedStyleIds);
    const stylesById = new Map(enabledStyles.map((style) => [style.id, style]));
    element.empty();
    element.addClass("fenced-blocks-rendered");
    const child = new MarkdownRenderChild(element);
    context.addChild(child);
    await renderNodes(app, nodes, element, context.sourcePath, child, stylesById);
  };
}

function getRenderableRoots(
  ranges: readonly FenceBlockRange[],
  allowedStyleIds: ReadonlySet<string>
): FenceBlockRange[] {
  const roots: FenceBlockRange[] = [];
  const stack: Array<{ range: FenceBlockRange; renderable: boolean }> = [];
  for (const range of ranges) {
    while (stack.length > 0 && stack[stack.length - 1]!.range.closeLine < range.openLine) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const renderable = (parent?.renderable ?? true) && allowedStyleIds.has(range.styleId);
    if (renderable && !parent) {
      roots.push(range);
    }
    stack.push({ range, renderable });
  }
  return roots;
}

function buildSectionSource(
  completeSource: string,
  sectionStart: number,
  sectionEnd: number,
  roots: readonly FenceBlockRange[]
): string {
  const lines = completeSource.split("\n");
  const end = Math.min(sectionEnd, lines.length - 1);
  const output: string[] = [];
  let line = Math.min(sectionStart, end);
  while (line <= end) {
    const containing = roots.find((range) => range.openLine <= line && range.closeLine >= line);
    if (!containing) {
      output.push(lines[line] ?? "");
      line += 1;
      continue;
    }
    if (line === containing.openLine) {
      output.push(...lines.slice(containing.openLine, containing.closeLine + 1));
    }
    line = containing.closeLine + 1;
  }
  return output.join("\n");
}
