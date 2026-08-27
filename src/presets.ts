import type { BlockStyle, FencedBlocksSettings } from "./types";

export const PRESET_STYLES: readonly BlockStyle[] = [
  {
    appearance: {
      accent: { dark: "#78c9a2", light: "#2f7d57" },
      background: { dark: "#17251e", light: "#f4faf7" },
      backgroundOpacity: 0,
      borderPlacement: "all",
      borderStyle: "solid",
      borderWidth: 1,
      fontStyle: "normal",
      fontWeight: "400",
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      radius: 7,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "definition",
    name: "Definition",
    presetId: "definition",
    showLabel: true
  },
  {
    appearance: {
      accent: { dark: "#8b96a5", light: "#687384" },
      background: { dark: "#a7b0bd", light: "#667085" },
      backgroundOpacity: 10,
      borderPlacement: "none",
      borderStyle: "solid",
      borderWidth: 0,
      fontStyle: "italic",
      fontWeight: "400",
      margin: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      radius: 6,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "comment",
    name: "Comment",
    presetId: "comment",
    showLabel: false
  },
  {
    appearance: {
      accent: { dark: "#7eb7ff", light: "#2563a9" },
      background: { dark: "#4c94e8", light: "#3b82c4" },
      backgroundOpacity: 11,
      borderPlacement: "left",
      borderStyle: "solid",
      borderWidth: 4,
      fontStyle: "normal",
      fontWeight: "400",
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      radius: 5,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "important",
    name: "Important",
    presetId: "important",
    showLabel: true
  },
  {
    appearance: {
      accent: { dark: "#f3a36c", light: "#b45309" },
      background: { dark: "#e57c36", light: "#f59e0b" },
      backgroundOpacity: 12,
      borderPlacement: "all",
      borderStyle: "solid",
      borderWidth: 1,
      fontStyle: "normal",
      fontWeight: "400",
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      radius: 7,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "warning",
    name: "Warning",
    presetId: "warning",
    showLabel: true
  },
  {
    appearance: {
      accent: { dark: "#c3a6ff", light: "#7651b5" },
      background: { dark: "#9575d8", light: "#8b5cf6" },
      backgroundOpacity: 8,
      borderPlacement: "left",
      borderStyle: "dashed",
      borderWidth: 2,
      fontStyle: "normal",
      fontWeight: "400",
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      radius: 4,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "example",
    name: "Example",
    presetId: "example",
    showLabel: true
  },
  {
    appearance: {
      accent: { dark: "#8f99a8", light: "#64748b" },
      background: { dark: "#8f99a8", light: "#64748b" },
      backgroundOpacity: 6,
      borderPlacement: "left",
      borderStyle: "solid",
      borderWidth: 2,
      fontStyle: "normal",
      fontWeight: "400",
      margin: 10,
      paddingHorizontal: 13,
      paddingVertical: 8,
      radius: 3,
      text: null
    },
    customCss: "",
    enabled: true,
    id: "aside",
    name: "Aside",
    presetId: "aside",
    showLabel: false
  }
] as const;

export function cloneStyle(style: BlockStyle): BlockStyle {
  return JSON.parse(JSON.stringify(style)) as BlockStyle;
}

export function createDefaultSettings(): FencedBlocksSettings {
  return {
    autocomplete: true,
    autoInsertClosingFence: true,
    contextMenu: true,
    livePreview: true,
    readingView: true,
    schemaVersion: 1,
    styles: PRESET_STYLES.map(cloneStyle)
  };
}
