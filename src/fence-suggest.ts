import {
  EditorSuggest,
  type Editor,
  type EditorPosition,
  type EditorSuggestContext,
  type EditorSuggestTriggerInfo,
  type TFile
} from "obsidian";

import { isLineProtected } from "./fence-parser";
import type FencedBlocksPlugin from "./main";
import type { BlockStyle } from "./types";

export class FenceSuggest extends EditorSuggest<BlockStyle> {
  constructor(private readonly plugin: FencedBlocksPlugin) {
    super(plugin.app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    if (!this.plugin.settings.autocomplete || isLineProtected(editor.getValue(), cursor.line)) {
      return null;
    }
    const beforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
    const match = /^ {0,3}:::([a-z0-9-]*)$/.exec(beforeCursor);
    if (!match) {
      return null;
    }
    return {
      end: cursor,
      query: match[1] ?? "",
      start: { ch: beforeCursor.indexOf(":::") + 3, line: cursor.line }
    };
  }

  getSuggestions(context: EditorSuggestContext): BlockStyle[] {
    const query = context.query.toLowerCase();
    return this.plugin.getEnabledStyles().filter((style) => (
      style.id.includes(query) || style.name.toLowerCase().includes(query)
    ));
  }

  renderSuggestion(style: BlockStyle, element: HTMLElement): void {
    element.createDiv({ cls: "fenced-block-suggestion__name", text: style.name });
    element.createDiv({ cls: "fenced-block-suggestion__syntax", text: `:::${style.id}` });
  }

  selectSuggestion(style: BlockStyle): void {
    const context = this.context;
    if (!context) {
      return;
    }
    const editor = context.editor;
    const line = editor.getLine(context.start.line);
    if (this.plugin.settings.autoInsertClosingFence && !line.slice(context.end.ch).trim()) {
      editor.replaceRange(
        `${style.id}\n\n:::`,
        context.start,
        { ch: line.length, line: context.end.line }
      );
      editor.setCursor({ ch: 0, line: context.start.line + 1 });
      return;
    }
    editor.replaceRange(style.id, context.start, context.end);
  }
}
