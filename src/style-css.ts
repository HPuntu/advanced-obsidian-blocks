import type { BlockStyle } from "./types";

const UNSAFE_CSS_VALUE = /[{}@]|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|<\/?style/iu;
const CSS_PROPERTY = /^(?:--[a-z0-9-]+|[a-z][a-z0-9-]*)$/i;

export function sanitizeCssDeclarations(source: string): string {
  const declarations: string[] = [];
  for (const rawDeclaration of source.split(";").slice(0, 40)) {
    const separator = rawDeclaration.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const property = rawDeclaration.slice(0, separator).trim();
    const value = rawDeclaration.slice(separator + 1).trim().slice(0, 300);
    if (!CSS_PROPERTY.test(property) || !value || UNSAFE_CSS_VALUE.test(value)) {
      continue;
    }
    declarations.push(`${property}: ${value};`);
  }
  return declarations.join(" ");
}

export function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(100, Math.max(0, opacity)) / 100})`;
}

export function buildInlineStyle(style: BlockStyle): string {
  const custom = sanitizeCssDeclarations(style.customCss);
  const appearance = style.appearance;
  return [
    `--fenced-block-accent-light:${appearance.accent.light}`,
    `--fenced-block-accent-dark:${appearance.accent.dark}`,
    `--fenced-block-background-light:${hexToRgba(appearance.background.light, appearance.backgroundOpacity)}`,
    `--fenced-block-background-dark:${hexToRgba(appearance.background.dark, appearance.backgroundOpacity)}`,
    `--fenced-block-text-light:${appearance.text?.light ?? "inherit"}`,
    `--fenced-block-text-dark:${appearance.text?.dark ?? "inherit"}`,
    `--fenced-block-border-style:${appearance.borderStyle}`,
    `--fenced-block-border-width:${appearance.borderWidth}px`,
    `--fenced-block-font-style:${appearance.fontStyle}`,
    `--fenced-block-font-weight:${appearance.fontWeight}`,
    `--fenced-block-margin:${appearance.margin}px`,
    `--fenced-block-padding-horizontal:${appearance.paddingHorizontal}px`,
    `--fenced-block-padding-vertical:${appearance.paddingVertical}px`,
    `--fenced-block-radius:${appearance.radius}px`,
    custom
  ].filter(Boolean).join(";");
}

export function applyStyleProperties(element: HTMLElement, style: BlockStyle): void {
  for (const declaration of buildInlineStyle(style).split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) {
      element.style.setProperty(property, value);
    }
  }
}
