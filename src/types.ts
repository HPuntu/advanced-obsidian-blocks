export interface ThemeColours {
  dark: string;
  light: string;
}

export type BorderPlacement = "all" | "left" | "none";
export type BorderStyle = "dashed" | "dotted" | "double" | "solid";
export type FontStyle = "italic" | "normal";
export type FontWeight = "400" | "500" | "600" | "700";

export interface BlockAppearance {
  accent: ThemeColours;
  background: ThemeColours;
  backgroundOpacity: number;
  borderPlacement: BorderPlacement;
  borderStyle: BorderStyle;
  borderWidth: number;
  fontStyle: FontStyle;
  fontWeight: FontWeight;
  margin: number;
  paddingHorizontal: number;
  paddingVertical: number;
  radius: number;
  text: ThemeColours | null;
}

export interface BlockStyle {
  appearance: BlockAppearance;
  customCss: string;
  enabled: boolean;
  id: string;
  name: string;
  presetId?: string;
  showLabel: boolean;
}

export interface FencedBlocksSettings {
  autocomplete: boolean;
  autoInsertClosingFence: boolean;
  contextMenu: boolean;
  livePreview: boolean;
  readingView: boolean;
  schemaVersion: 1;
  styles: BlockStyle[];
}

export interface FenceBlockRange {
  closeLine: number;
  depth: number;
  openLine: number;
  styleId: string;
}

export type ParsedNode =
  | { content: string; type: "markdown" }
  | { children: ParsedNode[]; styleId: string; type: "block" };
