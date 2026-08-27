import {
  Notice,
  PluginSettingTab,
  type SettingDefinition,
  type SettingDefinitionItem,
  type SettingDefinitionPage
} from "obsidian";

import {
  ConfirmModal,
  CreateStyleModal,
  JsonTransferModal,
  RenameStyleModal
} from "./modals";
import { cloneStyle, PRESET_STYLES } from "./presets";
import {
  createCustomStyle,
  createUniqueStyleId,
  mergeImportedStyles
} from "./settings-model";
import { sanitizeCssDeclarations } from "./style-css";
import type FencedBlocksPlugin from "./main";
import type { BlockStyle } from "./types";

type GlobalBooleanKey =
  | "autocomplete"
  | "autoInsertClosingFence"
  | "contextMenu"
  | "livePreview"
  | "readingView";

const GLOBAL_BOOLEAN_KEYS = new Set<GlobalBooleanKey>([
  "autocomplete",
  "autoInsertClosingFence",
  "contextMenu",
  "livePreview",
  "readingView"
]);

export class FencedBlocksSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: FencedBlocksPlugin) {
    super(plugin.app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        heading: "Editor and rendering",
        items: [
          this.toggleDefinition("readingView", "Reading view", "Render configured fences as styled blocks in reading view and PDF output."),
          this.toggleDefinition("livePreview", "Live preview", "Show block styling while editing. The source fence appears while its line is active."),
          this.toggleDefinition("autocomplete", "Fence autocomplete", "Suggest configured styles at the start of a line after typing three colons."),
          this.toggleDefinition("autoInsertClosingFence", "Insert closing fence", "Add the paired closing fence when autocomplete is used on an otherwise empty line."),
          this.toggleDefinition("contextMenu", "Editor context menu", "Add apply, change, and remove actions to the editor context menu.")
        ],
        type: "group"
      },
      {
        name: "Style library",
        searchable: false,
        render: (setting) => {
          setting
            .setName("Style library")
            .setDesc("Create, restore, import, or export reusable fenced block styles.")
            .addButton((button) => button
              .setButtonText("Restore presets")
              .onClick(() => this.restoreMissingPresets()))
            .addButton((button) => button
              .setButtonText("Import")
              .onClick(() => this.openImport()))
            .addButton((button) => button
              .setButtonText("Export")
              .onClick(() => this.openExport()));
        }
      },
      {
        addItem: {
          action: () => this.openCreateStyle(),
          name: "Add style"
        },
        cls: "fenced-block-settings-list",
        emptyState: "No styles yet. Add a style or restore the presets.",
        heading: "Block styles",
        items: this.plugin.settings.styles.map((style) => this.stylePage(style)),
        onReorder: (oldIndex, newIndex) => this.reorderStyle(oldIndex, newIndex),
        type: "list"
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (GLOBAL_BOOLEAN_KEYS.has(key as GlobalBooleanKey)) {
      return this.plugin.settings[key as GlobalBooleanKey];
    }
    const parsed = this.parseStyleKey(key);
    if (!parsed) {
      return undefined;
    }
    const { path, style } = parsed;
    switch (path) {
      case "enabled": return style.enabled;
      case "name": return style.name;
      case "showLabel": return style.showLabel;
      case "useTextColour": return style.appearance.text !== null;
      case "accent.light": return style.appearance.accent.light;
      case "accent.dark": return style.appearance.accent.dark;
      case "background.light": return style.appearance.background.light;
      case "background.dark": return style.appearance.background.dark;
      case "text.light": return style.appearance.text?.light ?? style.appearance.accent.light;
      case "text.dark": return style.appearance.text?.dark ?? style.appearance.accent.dark;
      case "backgroundOpacity": return style.appearance.backgroundOpacity;
      case "borderPlacement": return style.appearance.borderPlacement;
      case "borderStyle": return style.appearance.borderStyle;
      case "borderWidth": return style.appearance.borderWidth;
      case "radius": return style.appearance.radius;
      case "paddingVertical": return style.appearance.paddingVertical;
      case "paddingHorizontal": return style.appearance.paddingHorizontal;
      case "margin": return style.appearance.margin;
      case "fontWeight": return style.appearance.fontWeight;
      case "fontStyle": return style.appearance.fontStyle;
      case "customCss": return style.customCss;
      default: return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (GLOBAL_BOOLEAN_KEYS.has(key as GlobalBooleanKey)) {
      if (typeof value === "boolean") {
        this.plugin.settings[key as GlobalBooleanKey] = value;
        await this.plugin.saveSettings();
      }
      return;
    }
    const parsed = this.parseStyleKey(key);
    if (!parsed) {
      return;
    }
    const { path, style } = parsed;
    const appearance = style.appearance;
    switch (path) {
      case "enabled":
        if (typeof value === "boolean") style.enabled = value;
        break;
      case "name":
        if (typeof value === "string" && value.trim()) style.name = value.trim().slice(0, 60);
        break;
      case "showLabel":
        if (typeof value === "boolean") style.showLabel = value;
        break;
      case "useTextColour":
        if (value === true && !appearance.text) appearance.text = { ...appearance.accent };
        if (value === false) appearance.text = null;
        break;
      case "accent.light": appearance.accent.light = this.readColour(value, appearance.accent.light); break;
      case "accent.dark": appearance.accent.dark = this.readColour(value, appearance.accent.dark); break;
      case "background.light": appearance.background.light = this.readColour(value, appearance.background.light); break;
      case "background.dark": appearance.background.dark = this.readColour(value, appearance.background.dark); break;
      case "text.light":
        if (appearance.text) appearance.text.light = this.readColour(value, appearance.text.light);
        break;
      case "text.dark":
        if (appearance.text) appearance.text.dark = this.readColour(value, appearance.text.dark);
        break;
      case "backgroundOpacity": appearance.backgroundOpacity = this.readNumber(value, 0, 100, appearance.backgroundOpacity); break;
      case "borderWidth": appearance.borderWidth = this.readNumber(value, 0, 8, appearance.borderWidth); break;
      case "radius": appearance.radius = this.readNumber(value, 0, 30, appearance.radius); break;
      case "paddingVertical": appearance.paddingVertical = this.readNumber(value, 0, 40, appearance.paddingVertical); break;
      case "paddingHorizontal": appearance.paddingHorizontal = this.readNumber(value, 0, 40, appearance.paddingHorizontal); break;
      case "margin": appearance.margin = this.readNumber(value, 0, 40, appearance.margin); break;
      case "borderPlacement":
        if (value === "all" || value === "left" || value === "none") appearance.borderPlacement = value;
        break;
      case "borderStyle":
        if (value === "solid" || value === "dashed" || value === "dotted" || value === "double") appearance.borderStyle = value;
        break;
      case "fontWeight":
        if (value === "400" || value === "500" || value === "600" || value === "700") appearance.fontWeight = value;
        break;
      case "fontStyle":
        if (value === "normal" || value === "italic") appearance.fontStyle = value;
        break;
      case "customCss":
        if (typeof value === "string") style.customCss = value.slice(0, 4_000);
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
    if (path === "name") {
      this.update();
    } else if (path === "useTextColour") {
      this.refreshDomState();
    }
  }

  private toggleDefinition(key: GlobalBooleanKey, name: string, desc: string): SettingDefinition {
    return { control: { key, type: "toggle" }, desc, name };
  }

  private stylePage(style: BlockStyle): SettingDefinitionPage {
    const key = (path: string): string => `style:${style.id}:${path}`;
    const numberControl = (path: string, name: string, max: number, desc: string): SettingDefinition => ({
      control: {
        displayFormat: (value: number) => `${value}px`,
        key: key(path),
        max,
        min: 0,
        step: 1,
        type: "slider"
      },
      desc,
      name
    });
    const colourControl = (path: string, name: string): SettingDefinition => ({
      control: { key: key(path), type: "color" },
      name
    });

    return {
      desc: `Use as :::${style.id}`,
      displayValue: () => style.enabled ? `:::${style.id}` : "Disabled",
      items: [
        {
          heading: "Identity",
          items: [
            { control: { key: key("enabled"), type: "toggle" }, desc: "Disabled styles stay saved but render as ordinary Markdown.", name: "Enabled" },
            { control: { key: key("name"), placeholder: "Definition", type: "text" }, desc: "Used in the style picker and optional block heading.", name: "Display name" },
            { control: { key: key("showLabel"), type: "toggle" }, desc: "Show the display name at the top of the block.", name: "Show label" },
            { action: () => this.openRename(style), desc: "Explicitly update matching opening fences in Markdown files across the vault.", name: `Rename :::${style.id} in vault` }
          ],
          type: "group"
        },
        {
          heading: "Colours",
          items: [
            colourControl("accent.light", "Accent — light theme"),
            colourControl("accent.dark", "Accent — dark theme"),
            colourControl("background.light", "Background — light theme"),
            colourControl("background.dark", "Background — dark theme"),
            { control: { displayFormat: (value: number) => `${value}%`, key: key("backgroundOpacity"), max: 100, min: 0, step: 1, type: "slider" }, name: "Background opacity" },
            { control: { key: key("useTextColour"), type: "toggle" }, desc: "Off inherits the active Obsidian theme text colour.", name: "Custom text colour" },
            { control: { key: key("text.light"), type: "color" }, name: "Text — light theme", visible: () => style.appearance.text !== null },
            { control: { key: key("text.dark"), type: "color" }, name: "Text — dark theme", visible: () => style.appearance.text !== null }
          ],
          type: "group"
        },
        {
          heading: "Border and spacing",
          items: [
            { control: { key: key("borderPlacement"), options: { all: "Outline", left: "Left accent", none: "None" }, type: "dropdown" }, name: "Border placement" },
            { control: { key: key("borderStyle"), options: { dashed: "Dashed", dotted: "Dotted", double: "Double", solid: "Solid" }, type: "dropdown" }, name: "Border style" },
            numberControl("borderWidth", "Border width", 8, "Width of the outline or accent rail."),
            numberControl("radius", "Corner radius", 30, "Rounding applied to the block corners."),
            numberControl("paddingVertical", "Vertical padding", 40, "Space inside the top and bottom edges."),
            numberControl("paddingHorizontal", "Horizontal padding", 40, "Space inside the left and right edges."),
            numberControl("margin", "Vertical margin", 40, "Space outside the block.")
          ],
          type: "group"
        },
        {
          heading: "Typography and advanced",
          items: [
            { control: { key: key("fontWeight"), options: { "400": "Regular", "500": "Medium", "600": "Semibold", "700": "Bold" }, type: "dropdown" }, name: "Font weight" },
            { control: { key: key("fontStyle"), options: { italic: "Italic", normal: "Normal" }, type: "dropdown" }, name: "Font style" },
            {
              control: {
                key: key("customCss"),
                placeholder: "Letter-spacing: 0.01em;",
                type: "textarea",
                validate: (value: string) => value.trim() && !sanitizeCssDeclarations(value)
                  ? "No allowed CSS declarations were found. Selectors, @ rules, and URL loading are not accepted."
                  : undefined
              },
              desc: "Optional declarations only. Fenced Blocks supplies the selector and blocks network-loading or executable CSS.",
              name: "Advanced CSS declarations"
            }
          ],
          type: "group"
        },
        {
          heading: "Style actions",
          items: [
            { action: () => this.duplicateStyle(style), name: "Duplicate style" },
            { action: () => this.resetPreset(style), disabled: !style.presetId, name: "Reset preset" },
            { action: () => this.confirmDelete(style), desc: "Existing fences in notes are preserved as ordinary Markdown.", name: "Delete style" }
          ],
          type: "group"
        }
      ],
      name: style.name,
      status: () => style.customCss.trim() && !sanitizeCssDeclarations(style.customCss) ? "warning" : null,
      type: "page"
    };
  }

  private parseStyleKey(key: string): { path: string; style: BlockStyle } | null {
    const match = /^style:([a-z][a-z0-9-]{0,39}):(.+)$/.exec(key);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    const style = this.plugin.settings.styles.find((candidate) => candidate.id === match[1]);
    return style ? { path: match[2], style } : null;
  }

  private readColour(value: unknown, fallback: string): string {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  private readNumber(value: unknown, min: number, max: number, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  }

  private openCreateStyle(): void {
    const existing = new Set(this.plugin.settings.styles.map((style) => style.id));
    new CreateStyleModal(this.app, existing, (name, styleId) => {
      const style = createCustomStyle(name, this.plugin.settings.styles);
      style.id = styleId;
      this.plugin.settings.styles.push(style);
      void this.plugin.saveSettings().then(() => this.update());
    }).open();
  }

  private restoreMissingPresets(): void {
    const used = new Set(this.plugin.settings.styles.map((style) => style.id));
    const missing = PRESET_STYLES.filter((preset) => !used.has(preset.id));
    this.plugin.settings.styles.push(...missing.map(cloneStyle));
    void this.plugin.saveSettings().then(() => this.update());
    new Notice(missing.length > 0 ? `Restored ${missing.length} preset style${missing.length === 1 ? "" : "s"}.` : "All presets are already present.");
  }

  private reorderStyle(oldIndex: number, newIndex: number): void {
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const [style] = this.plugin.settings.styles.splice(oldIndex, 1);
    if (!style) {
      return;
    }
    this.plugin.settings.styles.splice(newIndex, 0, style);
    void this.plugin.saveSettings().then(() => this.update());
  }

  private duplicateStyle(style: BlockStyle): void {
    const duplicate = cloneStyle(style);
    duplicate.name = `${style.name} copy`;
    duplicate.id = createUniqueStyleId(duplicate.name, this.plugin.settings.styles);
    delete duplicate.presetId;
    const index = this.plugin.settings.styles.indexOf(style);
    this.plugin.settings.styles.splice(index + 1, 0, duplicate);
    void this.plugin.saveSettings().then(() => this.update());
  }

  private resetPreset(style: BlockStyle): void {
    const preset = PRESET_STYLES.find((candidate) => candidate.presetId === style.presetId);
    if (!preset) {
      return;
    }
    const index = this.plugin.settings.styles.indexOf(style);
    this.plugin.settings.styles.splice(index, 1, cloneStyle(preset));
    void this.plugin.saveSettings().then(() => this.update());
  }

  private confirmDelete(style: BlockStyle): void {
    new ConfirmModal(
      this.app,
      `Delete ${style.name}?`,
      `This removes the style configuration. Existing :::${style.id} fences are not changed and will return to ordinary Markdown text.`,
      "Delete style",
      () => {
        this.plugin.settings.styles = this.plugin.settings.styles.filter((candidate) => candidate !== style);
        void this.plugin.saveSettings().then(() => this.update());
      }
    ).open();
  }

  private openRename(style: BlockStyle): void {
    const existing = new Set(this.plugin.settings.styles.map((candidate) => candidate.id));
    new RenameStyleModal(this.app, style, existing, async (nextId) => {
      const result = await this.plugin.renameStyleInVault(style, nextId);
      this.update();
      return result;
    }).open();
  }

  private openExport(): void {
    new JsonTransferModal(this.app, "export", JSON.stringify(this.plugin.settings, null, 2)).open();
  }

  private openImport(): void {
    new JsonTransferModal(this.app, "import", "", (value, replace) => {
      this.plugin.settings = mergeImportedStyles(this.plugin.settings, value, replace);
      void this.plugin.saveSettings().then(() => {
        this.update();
        new Notice("Fenced block styles imported.");
      });
    }).open();
  }
}
