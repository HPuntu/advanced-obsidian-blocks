import { cloneStyle, createDefaultSettings, PRESET_STYLES } from "./presets";
import type {
  BlockAppearance,
  BlockStyle,
  BorderPlacement,
  BorderStyle,
  FencedBlocksSettings,
  FontStyle,
  FontWeight,
  ThemeColours
} from "./types";

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const STYLE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const BORDER_PLACEMENTS = new Set<BorderPlacement>(["all", "left", "none"]);
const BORDER_STYLES = new Set<BorderStyle>(["dashed", "dotted", "double", "solid"]);
const FONT_STYLES = new Set<FontStyle>(["italic", "normal"]);
const FONT_WEIGHTS = new Set<FontWeight>(["400", "500", "600", "700"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function readString(value: unknown, fallback: string, maximumLength = 100): string {
  return typeof value === "string" ? value.slice(0, maximumLength) : fallback;
}

function readChoice<T extends string>(value: unknown, choices: ReadonlySet<T>, fallback: T): T {
  return typeof value === "string" && choices.has(value as T) ? (value as T) : fallback;
}

function normalizeColours(value: unknown, fallback: ThemeColours): ThemeColours {
  if (!isRecord(value)) {
    return { ...fallback };
  }
  return {
    dark: typeof value.dark === "string" && HEX_COLOUR.test(value.dark) ? value.dark : fallback.dark,
    light: typeof value.light === "string" && HEX_COLOUR.test(value.light) ? value.light : fallback.light
  };
}

function normalizeAppearance(value: unknown, fallback: BlockAppearance): BlockAppearance {
  const source = isRecord(value) ? value : {};
  const text = source.text === null
    ? null
    : isRecord(source.text)
      ? normalizeColours(source.text, fallback.text ?? fallback.accent)
      : fallback.text;

  return {
    accent: normalizeColours(source.accent, fallback.accent),
    background: normalizeColours(source.background, fallback.background),
    backgroundOpacity: readNumber(source.backgroundOpacity, fallback.backgroundOpacity, 0, 100),
    borderPlacement: readChoice(source.borderPlacement, BORDER_PLACEMENTS, fallback.borderPlacement),
    borderStyle: readChoice(source.borderStyle, BORDER_STYLES, fallback.borderStyle),
    borderWidth: readNumber(source.borderWidth, fallback.borderWidth, 0, 8),
    fontStyle: readChoice(source.fontStyle, FONT_STYLES, fallback.fontStyle),
    fontWeight: readChoice(source.fontWeight, FONT_WEIGHTS, fallback.fontWeight),
    margin: readNumber(source.margin, fallback.margin, 0, 40),
    paddingHorizontal: readNumber(source.paddingHorizontal, fallback.paddingHorizontal, 0, 40),
    paddingVertical: readNumber(source.paddingVertical, fallback.paddingVertical, 0, 40),
    radius: readNumber(source.radius, fallback.radius, 0, 30),
    text
  };
}

export function slugifyStyleId(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(slug) ? slug : `block-${slug || "custom"}`.slice(0, 40);
}

export function createUniqueStyleId(name: string, styles: readonly BlockStyle[]): string {
  const base = slugifyStyleId(name);
  const used = new Set(styles.map((style) => style.id));
  if (!used.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, Math.max(1, 39 - String(suffix).length))}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `block-${Date.now().toString(36)}`.slice(0, 40);
}

export function normalizeStyle(value: unknown, fallback = PRESET_STYLES[0]): BlockStyle | null {
  if (!fallback || !isRecord(value)) {
    return null;
  }
  const rawId = readString(value.id, fallback.id, 40).toLowerCase();
  if (!STYLE_ID.test(rawId)) {
    return null;
  }
  const name = readString(value.name, fallback.name, 60).trim() || fallback.name;
  return {
    appearance: normalizeAppearance(value.appearance, fallback.appearance),
    customCss: readString(value.customCss, "", 4_000),
    enabled: readBoolean(value.enabled, true),
    id: rawId,
    name,
    presetId: typeof value.presetId === "string" ? value.presetId.slice(0, 40) : undefined,
    showLabel: readBoolean(value.showLabel, fallback.showLabel)
  };
}

export function normalizeSettings(value: unknown): FencedBlocksSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(value)) {
    return defaults;
  }
  const hasStyleLibrary = Array.isArray(value.styles);
  const rawStyles = Array.isArray(value.styles) ? value.styles.slice(0, 100) : [];
  const styles: BlockStyle[] = [];
  const usedIds = new Set<string>();
  for (const rawStyle of rawStyles) {
    const presetId = isRecord(rawStyle) && typeof rawStyle.presetId === "string" ? rawStyle.presetId : "";
    const fallback = PRESET_STYLES.find((preset) => preset.presetId === presetId) ?? PRESET_STYLES[0];
    const style = normalizeStyle(rawStyle, fallback);
    if (style && !usedIds.has(style.id)) {
      styles.push(style);
      usedIds.add(style.id);
    }
  }
  return {
    autocomplete: readBoolean(value.autocomplete, defaults.autocomplete),
    autoInsertClosingFence: readBoolean(value.autoInsertClosingFence, defaults.autoInsertClosingFence),
    contextMenu: readBoolean(value.contextMenu, defaults.contextMenu),
    livePreview: readBoolean(value.livePreview, defaults.livePreview),
    readingView: readBoolean(value.readingView, defaults.readingView),
    schemaVersion: 1,
    styles: hasStyleLibrary ? styles : defaults.styles
  };
}

export function createCustomStyle(name: string, styles: readonly BlockStyle[]): BlockStyle {
  const base = cloneStyle(PRESET_STYLES[0]!);
  base.id = createUniqueStyleId(name, styles);
  base.name = name.trim() || "Custom block";
  delete base.presetId;
  return base;
}

export function mergeImportedStyles(
  current: FencedBlocksSettings,
  imported: unknown,
  replace: boolean
): FencedBlocksSettings {
  if (!isRecord(imported) || !Array.isArray(imported.styles)) {
    throw new TypeError("Imported data is not a Fenced Blocks settings export.");
  }
  const normalized = normalizeSettings(imported);
  if (replace) {
    return normalized;
  }
  const next = normalizeSettings(current);
  const byId = new Map(next.styles.map((style) => [style.id, style]));
  for (const style of normalized.styles) {
    byId.set(style.id, style);
  }
  next.styles = Array.from(byId.values()).slice(0, 100);
  return next;
}
