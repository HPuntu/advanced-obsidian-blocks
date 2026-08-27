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

    constructor(view: EditorView) {
      this.decorations = createDecorations(view, getSettings());
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet) {
        this.decorations = createDecorations(update.view, getSettings());
      }
    }
  }, {
    decorations: (value) => value.decorations
  });
}
