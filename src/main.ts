import {
  MarkdownView,
  Notice,
  Plugin,
  type Command,
  type Editor,
  type Menu
} from "obsidian";

import {
  applyStyleToEditor,
  canEditFenceAtCursor,
  changeFenceStyleAtCursor,
  unwrapFenceAtCursor
} from "./editor-actions";
import { FenceSuggest } from "./fence-suggest";
import { renameFenceStyle } from "./fence-parser";
import { createLivePreviewExtension } from "./live-preview";
import { CreateStyleModal, StylePickerModal } from "./modals";
import { createReadingViewProcessor } from "./reading-view";
import { createDefaultSettings } from "./presets";
import { createCustomStyle, normalizeSettings } from "./settings-model";
import { FencedBlocksSettingTab } from "./settings-tab";
import type { BlockStyle, FencedBlocksSettings } from "./types";

export default class FencedBlocksPlugin extends Plugin {
  settings: FencedBlocksSettings = createDefaultSettings();
  private readonly registeredStyleCommands = new Set<string>();
  private refreshTimer: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.addSettingTab(new FencedBlocksSettingTab(this));
    this.registerMarkdownPostProcessor(createReadingViewProcessor(this.app, () => this.settings));
    this.registerEditorExtension(createLivePreviewExtension(() => this.settings));
    this.registerEditorSuggest(new FenceSuggest(this));
    this.registerCoreCommands();
    this.ensureStyleCommands();
    this.registerEditorMenu();
    this.addRibbonIcon("square", "Apply fenced block", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.openStylePicker(view.editor, "apply");
      } else {
        new Notice("Open a Markdown note to apply a fenced block.");
      }
    });
  }

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getEnabledStyles(): BlockStyle[] {
    return this.settings.styles.filter((style) => style.enabled);
  }

  async saveSettings(): Promise<void> {
    const save = this.saveQueue
      .catch(() => undefined)
      .then(() => this.saveData(this.settings));
    this.saveQueue = save;
    await save;
    this.ensureStyleCommands();
    this.scheduleViewRefresh();
  }

  async renameStyleInVault(
    style: BlockStyle,
    nextId: string
  ): Promise<{ files: number; occurrences: number }> {
    if (nextId === style.id) {
      return { files: 0, occurrences: 0 };
    }
    if (this.settings.styles.some((candidate) => candidate !== style && candidate.id === nextId)) {
      throw new Error(`Style ${nextId} already exists.`);
    }
    const oldId = style.id;
    let files = 0;
    let occurrences = 0;
    for (const file of this.app.vault.getMarkdownFiles()) {
      const source = await this.app.vault.cachedRead(file);
      const preview = renameFenceStyle(source, oldId, nextId);
      if (preview.count === 0) {
        continue;
      }
      await this.app.vault.process(file, (current) => renameFenceStyle(current, oldId, nextId).source);
      files += 1;
      occurrences += preview.count;
    }
    style.id = nextId;
    await this.saveSettings();
    return { files, occurrences };
  }

  private registerCoreCommands(): void {
    this.addCommand({
      editorCallback: (editor) => this.openStylePicker(editor, "apply"),
      id: "apply-fenced-block",
      name: "Apply fenced block…"
    });
    this.addCommand({
      editorCheckCallback: (checking, editor) => {
        const available = canEditFenceAtCursor(editor, this.getEnabledStyleIds());
        if (available && !checking) {
          this.openStylePicker(editor, "change");
        }
        return available;
      },
      id: "change-fenced-block-style",
      name: "Change fenced block style…"
    });
    this.addCommand({
      editorCheckCallback: (checking, editor) => {
        const available = canEditFenceAtCursor(editor, this.getEnabledStyleIds());
        if (available && !checking) {
          unwrapFenceAtCursor(editor, this.getEnabledStyleIds());
        }
        return available;
      },
      id: "remove-fenced-block",
      name: "Remove fenced block formatting"
    });
  }

  private scheduleViewRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.app.workspace.updateOptions();
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view instanceof MarkdownView) {
          leaf.view.previewMode.rerender(true);
        }
      }
    }, 120);
  }

  private ensureStyleCommands(): void {
    for (const style of this.settings.styles) {
      if (this.registeredStyleCommands.has(style.id)) {
        continue;
      }
      const styleId = style.id;
      const command: Command = {
        editorCheckCallback: (checking, editor) => {
          const current = this.settings.styles.find((candidate) => candidate.id === styleId && candidate.enabled);
          if (!current) {
            return false;
          }
          if (!checking) {
            applyStyleToEditor(editor, current.id);
          }
          return true;
        },
        id: `apply-${styleId}`,
        name: `Apply block: ${style.name}`
      };
      this.addCommand(command);
      this.registeredStyleCommands.add(styleId);
    }
  }

  private registerEditorMenu(): void {
    this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
      if (!this.settings.contextMenu) {
        return;
      }
      menu.addSeparator();
      menu.addItem((item) => item
        .setIcon("square")
        .setTitle("Apply fenced block…")
        .onClick(() => this.openStylePicker(editor, "apply")));
      if (canEditFenceAtCursor(editor, this.getEnabledStyleIds())) {
        menu.addItem((item) => item
          .setIcon("palette")
          .setTitle("Change fenced block style…")
          .onClick(() => this.openStylePicker(editor, "change")));
        menu.addItem((item) => item
          .setIcon("unwrap-text")
          .setTitle("Remove fenced block formatting")
          .onClick(() => {
            unwrapFenceAtCursor(editor, this.getEnabledStyleIds());
          }));
      }
    }));
  }

  private openStylePicker(editor: Editor, mode: "apply" | "change"): void {
    new StylePickerModal(
      this.app,
      this.getEnabledStyles(),
      (style) => {
        if (mode === "change") {
          changeFenceStyleAtCursor(editor, style.id, this.getEnabledStyleIds());
        } else {
          applyStyleToEditor(editor, style.id);
        }
      },
      () => this.openCreateAndApply(editor, mode)
    ).open();
  }

  private openCreateAndApply(editor: Editor, mode: "apply" | "change"): void {
    const existingIds = new Set(this.settings.styles.map((style) => style.id));
    new CreateStyleModal(this.app, existingIds, (name, styleId) => {
      const style = createCustomStyle(name, this.settings.styles);
      style.id = styleId;
      this.settings.styles.push(style);
      void this.saveSettings().then(() => {
        if (mode === "change") {
          changeFenceStyleAtCursor(editor, style.id, this.getEnabledStyleIds());
        } else {
          applyStyleToEditor(editor, style.id);
        }
      });
    }).open();
  }

  private getEnabledStyleIds(): Set<string> {
    return new Set(this.getEnabledStyles().map((style) => style.id));
  }
}
