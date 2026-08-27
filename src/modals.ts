import {
  FuzzySuggestModal,
  Modal,
  Notice,
  Setting,
  type App
} from "obsidian";

import { slugifyStyleId } from "./settings-model";
import type { BlockStyle } from "./types";

type StyleChoice =
  | { kind: "create" }
  | { kind: "style"; style: BlockStyle };

export class StylePickerModal extends FuzzySuggestModal<StyleChoice> {
  constructor(
    app: App,
    private readonly styles: readonly BlockStyle[],
    private readonly onChooseStyle: (style: BlockStyle) => void,
    private readonly onCreateStyle: () => void
  ) {
    super(app);
    this.setPlaceholder("Choose a fenced block style…");
    this.setInstructions([
      { command: "↑↓", purpose: "Navigate" },
      { command: "↵", purpose: "Apply" },
      { command: "esc", purpose: "Close" }
    ]);
  }

  getItems(): StyleChoice[] {
    return [
      ...this.styles.map((style): StyleChoice => ({ kind: "style", style })),
      { kind: "create" }
    ];
  }

  getItemText(choice: StyleChoice): string {
    return choice.kind === "create"
      ? "Create new style"
      : `${choice.style.name} :::${choice.style.id}`;
  }

  onChooseItem(choice: StyleChoice): void {
    if (choice.kind === "create") {
      this.onCreateStyle();
    } else {
      this.onChooseStyle(choice.style);
    }
  }
}

export class CreateStyleModal extends Modal {
  private name = "";
  private styleId = "";
  private idWasEdited = false;

  constructor(
    app: App,
    private readonly existingIds: ReadonlySet<string>,
    private readonly onCreate: (name: string, styleId: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Create fenced block style");
    new Setting(this.contentEl)
      .setName("Name")
      .setDesc("The label shown in settings and optional block headings.")
      .addText((text) => {
        text.setPlaceholder("Key idea");
        text.inputEl.autofocus = true;
        text.onChange((value) => {
          this.name = value;
          if (!this.idWasEdited) {
            this.styleId = slugifyStyleId(value);
            idInput?.setValue(this.styleId);
          }
        });
      });

    let idInput: { setValue: (value: string) => unknown } | null = null;
    new Setting(this.contentEl)
      .setName("Fence name")
      .setDesc("Lowercase letters, numbers, and hyphens; used as :::name.")
      .addText((text) => {
        idInput = text;
        text.setPlaceholder("Custom block");
        text.onChange((value) => {
          this.idWasEdited = true;
          this.styleId = value.trim().toLowerCase();
        });
      });

    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText("Create style")
        .setCta()
        .onClick(() => this.submit()));
  }

  private submit(): void {
    const name = this.name.trim();
    const styleId = this.styleId.trim();
    if (!name) {
      new Notice("Enter a style name.");
      return;
    }
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(styleId)) {
      new Notice("Fence names must start with a letter and use only lowercase letters, numbers, and hyphens.");
      return;
    }
    if (this.existingIds.has(styleId)) {
      new Notice(`A style named :::${styleId} already exists.`);
      return;
    }
    this.close();
    this.onCreate(name, styleId);
  }
}

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly confirmLabel: string,
    private readonly onConfirm: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText("Cancel")
        .onClick(() => this.close()))
      .addButton((button) => button
        .setButtonText(this.confirmLabel)
        .setDestructive()
        .onClick(() => {
          this.close();
          this.onConfirm();
        }));
  }
}

export class JsonTransferModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private readonly mode: "export" | "import",
    initialValue: string,
    private readonly onImport?: (value: unknown, replace: boolean) => void
  ) {
    super(app);
    this.value = initialValue;
  }

  onOpen(): void {
    this.setTitle(this.mode === "export" ? "Export fenced block styles" : "Import fenced block styles");
    this.contentEl.createEl("p", {
      text: this.mode === "export"
        ? "Copy this JSON to share or back up your styles."
        : "Paste JSON exported by Fenced Blocks. Imported styles are validated before they are saved."
    });
    const textArea = this.contentEl.createEl("textarea", { cls: "fenced-block-json" });
    textArea.value = this.value;
    textArea.readOnly = this.mode === "export";
    textArea.addEventListener("input", () => {
      this.value = textArea.value;
    });
    if (this.mode === "export") {
      textArea.select();
      return;
    }

    let replace = false;
    new Setting(this.contentEl)
      .setName("Replace current styles")
      .setDesc("Off merges imported styles by fence name. On replaces the complete configuration.")
      .addToggle((toggle) => toggle.onChange((value) => {
        replace = value;
      }));
    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText("Import")
        .setCta()
        .onClick(() => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(this.value);
          } catch {
            new Notice("The pasted text is not valid JSON.");
            return;
          }
          try {
            this.onImport?.(parsed, replace);
            this.close();
          } catch {
            new Notice("The JSON is valid, but it does not contain exported fenced block settings.");
          }
        }));
  }
}

export class RenameStyleModal extends Modal {
  private nextId: string;

  constructor(
    app: App,
    private readonly style: BlockStyle,
    private readonly existingIds: ReadonlySet<string>,
    private readonly onRename: (nextId: string) => Promise<{ files: number; occurrences: number }>
  ) {
    super(app);
    this.nextId = style.id;
  }

  onOpen(): void {
    this.setTitle(`Rename :::${this.style.id}`);
    this.contentEl.createEl("p", {
      text: "This explicitly updates matching opening fences in Markdown files throughout the vault, then updates the style. Code blocks and comments are left untouched."
    });
    new Setting(this.contentEl)
      .setName("New fence name")
      .addText((text) => text
        .setValue(this.style.id)
        .onChange((value) => {
          this.nextId = value.trim().toLowerCase();
        }));
    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText("Rename in vault")
        .setDestructive()
        .onClick(async () => {
          if (!/^[a-z][a-z0-9-]{0,39}$/.test(this.nextId)) {
            new Notice("Use a lowercase fence name that starts with a letter.");
            return;
          }
          if (this.nextId !== this.style.id && this.existingIds.has(this.nextId)) {
            new Notice(`:::${this.nextId} already exists.`);
            return;
          }
          button.setDisabled(true).setButtonText("Renaming…");
          try {
            const result = await this.onRename(this.nextId);
            new Notice(`Renamed ${result.occurrences} fence${result.occurrences === 1 ? "" : "s"} in ${result.files} file${result.files === 1 ? "" : "s"}.`);
            this.close();
          } catch {
            button.setDisabled(false).setButtonText("Rename in vault");
            new Notice("The rename could not be completed. No files are deleted by this operation.");
          }
        }));
  }
}
