import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

import { scanFencedBlocks } from "./fence-parser";
import { buildInlineStyle } from "./style-css";
import type { BlockStyle, FenceBlockRange, FencedBlocksSettings } from "./types";

interface LineState {
  boundary: "close" | "content" | "open";
  depth: number;
  style: BlockStyle;
}

const EMBED_STYLE_CLASS = "fenced-block-embed";
const EMBED_SELECTOR = ".cm-embed-block";

function clearEmbedStyle(element: HTMLElement): void {
  element.removeClass(EMBED_STYLE_CLASS);
  element.removeAttribute("data-fenced-block-border");
  element.removeAttribute("data-fenced-block-depth");
  element.removeAttribute("data-fenced-block-style");
  for (const property of Array.from(element.style)) {
    if (property.startsWith("--fenced-block-")) {
      element.style.removeProperty(property);
    }
  }
}

function syncEmbeddedBlocks(root: HTMLElement): void {
  const embeds = root.querySelectorAll<HTMLElement>(EMBED_SELECTOR);
  for (const embed of Array.from(embeds)) {
    clearEmbedStyle(embed);
    const previous = embed.previousElementSibling;
    const next = embed.nextElementSibling;
    const sourceLine = [previous, next].find((element): element is HTMLElement =>
      element instanceof HTMLElement && element.matches(".cm-line.fenced-block-line")
    );
    if (!sourceLine) {
      continue;
    }

    embed.addClass(EMBED_STYLE_CLASS);
    for (const attribute of ["data-fenced-block-border", "data-fenced-block-depth", "data-fenced-block-style"]) {
      const value = sourceLine.getAttribute(attribute);
      if (value !== null) {
        embed.setAttribute(attribute, value);
      }
    }
    for (const property of Array.from(sourceLine.style)) {
      if (property.startsWith("--fenced-block-")) {
        embed.style.setProperty(property, sourceLine.style.getPropertyValue(property));
      }
    }
  }
}

class FenceLabelWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: FenceLabelWidget): boolean {
    return other.label === this.label;
  }

  toDOM(): HTMLElement {
    return createSpan({
      cls: "fenced-block-marker fenced-block-marker--open",
      text: this.label
    });
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class FenceClosingWidget extends WidgetType {
  toDOM(): HTMLElement {
    return createSpan({ cls: "fenced-block-marker fenced-block-marker--close" });
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function cursorTouchesLine(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.head >= from && range.head <= to);
}

function collectLineStates(
  ranges: readonly FenceBlockRange[],
  stylesById: ReadonlyMap<string, BlockStyle>
): Map<number, LineState> {
  const lineStates = new Map<number, LineState>();
  const openings = new Map(ranges.map((range) => [range.openLine, range]));
  const maximumClose = Math.max(-1, ...ranges.map((range) => range.closeLine));
  const stack: Array<{ range: FenceBlockRange; renderable: boolean; style?: BlockStyle }> = [];

  for (let line = 0; line <= maximumClose; line += 1) {
    const opening = openings.get(line);
    if (opening) {
      const style = stylesById.get(opening.styleId);
      const renderable = (stack[stack.length - 1]?.renderable ?? true) && Boolean(style?.enabled);
      stack.push({ range: opening, renderable, style });
      if (renderable && style) {
        lineStates.set(line, { boundary: "open", depth: opening.depth, style });
      }
      continue;
    }

    const active = stack[stack.length - 1];
    if (!active) {
      continue;
    }
    if (line === active.range.closeLine) {
      if (active.renderable && active.style) {
        lineStates.set(line, {
          boundary: "close",
          depth: active.range.depth,
          style: active.style
        });
      }
      stack.pop();
      continue;
    }
    if (active.renderable && active.style) {
      lineStates.set(line, {
        boundary: "content",
        depth: active.range.depth,
        style: active.style
      });
    }
  }
  return lineStates;
}

function createDecorations(view: EditorView, settings: FencedBlocksSettings): DecorationSet {
  if (!settings.livePreview || !view.state.field(editorLivePreviewField)) {
    return Decoration.none;
  }
  const source = view.state.doc.toString();
  const stylesById = new Map(settings.styles.map((style) => [style.id, style]));
  const lineStates = collectLineStates(scanFencedBlocks(source), stylesById);
  const decorations: Array<{ decoration: Decoration; from: number; to?: number }> = [];

  for (const [zeroBasedLine, state] of lineStates) {
    if (zeroBasedLine >= view.state.doc.lines) {
      continue;
    }
    const line = view.state.doc.line(zeroBasedLine + 1);
    decorations.push({
      decoration: Decoration.line({
        attributes: {
          "data-fenced-block-boundary": state.boundary,
          "data-fenced-block-border": state.style.appearance.borderPlacement,
          "data-fenced-block-depth": String(state.depth),
          "data-fenced-block-style": state.style.id,
          "style": `${buildInlineStyle(state.style)};--fenced-block-depth:${Math.min(state.depth, 12)}`
        },
        class: "fenced-block-line"
      }),
      from: line.from
    });

    if (state.boundary === "content") {
      continue;
    }
    if (cursorTouchesLine(view, line.from, line.to)) {
      decorations.push({
        decoration: Decoration.mark({ class: "fenced-block-marker-source" }),
        from: line.from,
        to: line.to
      });
      continue;
    }
    const widget = state.boundary === "open"
      ? new FenceLabelWidget(state.style.showLabel ? state.style.name : "")
      : new FenceClosingWidget();
    decorations.push({
      decoration: Decoration.replace({ inclusive: false, widget }),
      from: line.from,
      to: line.to
    });
  }

  return Decoration.set(decorations.map((range) => range.decoration.range(range.from, range.to)), true);
}

export function createLivePreviewExtension(getSettings: () => FencedBlocksSettings): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    private animationFrame: number | null = null;
    private readonly observer: MutationObserver;
    private readonly view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.decorations = createDecorations(view, getSettings());
      this.observer = new MutationObserver(() => this.scheduleEmbedSync());
      this.observer.observe(view.dom, { childList: true, subtree: true });
      this.scheduleEmbedSync();
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet) {
        this.decorations = createDecorations(update.view, getSettings());
      }
      this.scheduleEmbedSync();
    }

    destroy(): void {
      this.observer.disconnect();
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
      }
      for (const embed of Array.from(this.view.dom.querySelectorAll<HTMLElement>(`.${EMBED_STYLE_CLASS}`))) {
        clearEmbedStyle(embed);
      }
    }

    private scheduleEmbedSync(): void {
      if (this.animationFrame !== null) {
        return;
      }
      this.animationFrame = window.requestAnimationFrame(() => {
        this.animationFrame = null;
        syncEmbeddedBlocks(this.view.dom);
      });
    }
  }, {
    decorations: (value) => value.decorations
  });
}
