import { applyStyleProperties } from "./style-css";
import type { BlockStyle } from "./types";

function prepareStyledElement(element: HTMLElement, style: BlockStyle, includeCustomCss: boolean): void {
  element.removeAttribute("style");
  element.dataset.fencedBlockBorder = style.appearance.borderPlacement;
  element.dataset.fencedBlockStyle = style.id;
  element.dataset.fencedBlockName = style.name;
  applyStyleProperties(element, includeCustomCss ? style : { ...style, customCss: "" });
}

export function renderStyleOption(element: HTMLElement, style: BlockStyle): void {
  element.empty();
  element.addClass("fenced-block-style-option");
  element.setAttribute("aria-label", `${style.name}, fence ${style.id}`);

  const swatch = element.createDiv({ cls: "fenced-block fenced-block-style-swatch" });
  swatch.setAttribute("aria-hidden", "true");
  prepareStyledElement(swatch, style, false);

  const text = element.createDiv({ cls: "fenced-block-style-option__text" });
  text.createDiv({ cls: "fenced-block-suggestion__name", text: style.name });
  text.createDiv({ cls: "fenced-block-suggestion__syntax", text: `:::${style.id}` });
}

export function renderStylePreview(container: HTMLElement, style: BlockStyle): void {
  container.empty();
  const block = container.createDiv({ cls: "fenced-block fenced-block-settings-preview__block" });
  block.setAttribute("aria-label", `Preview of the ${style.name} block style`);
  block.setAttribute("role", "group");
  prepareStyledElement(block, style, true);
  if (style.showLabel) {
    block.createDiv({ cls: "fenced-block__label", text: style.name });
  }
  const content = block.createDiv({ cls: "fenced-block__content" });
  content.createEl("p", {
    text: "A well-designed block keeps an important idea distinct without interrupting the note."
  });
}
