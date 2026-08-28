# Safety review — Advanced Obsidian Blocks

Scope: the 0.1.0 foundation, reviewed for public release and Obsidian's automated community-plugin checks.

## Summary

Advanced Obsidian Blocks reads its own settings and the Markdown currently being rendered or edited. It does not access the network, execute programs, open ports, collect telemetry, install updates, or delete files.

## Vault access

- Normal rendering and editor features operate on source already supplied by Obsidian.
- Import/export uses a visible text area. It does not access the clipboard automatically or write export files.
- The explicit **Rename in vault** action enumerates Markdown files using `vault.getMarkdownFiles()`, reads them with `vault.cachedRead()`, and updates matching files with `vault.process()`.
- Rename changes exact `:::old-name` opening-fence lines only. It skips fenced code blocks and Obsidian `%%` comments. Closing fences and all unrelated content are preserved.
- Rename never deletes, moves, or creates files.

## Untrusted settings

Plugin data can arrive through a synced or shared vault, so all loaded and imported settings are treated as untrusted:

- The settings schema is reconstructed field by field rather than trusted by type assertion.
- Style count, string lengths, colour formats, numeric ranges, enum values, and unique fence names are bounded.
- Rendering uses `textContent`, Obsidian DOM helpers, and `dataset`; no setting is inserted as HTML.
- Style IDs are restricted to lowercase ASCII letters, numbers, and hyphens before being used in CSS selectors or command IDs.

## Advanced CSS

Advanced CSS is intentionally not a raw stylesheet. The sanitizer accepts at most 40 `property: value` declarations and rejects braces, selectors, `@` rules, `url(...)`, `javascript:`, `expression(...)`, `behavior`, `-moz-binding`, and style-tag text. This prevents settings from introducing network egress or executable legacy CSS. Rejected declarations are not applied.

## Parser and performance limits

- Parsing is linear by source line for ordinary documents.
- Only matched paired fences render.
- Code fences and comments are excluded before custom fences are scanned.
- Settings are capped at 100 styles.
- Custom CSS is capped at 4,000 characters per style.
- Live Preview uses CodeMirror decorations and does not rewrite note content.
- Reading View re-renders only source sections that contain a configured, enabled fence.

## Release controls

- CI runs type checking, the Obsidian ESLint rules, unit tests, a production build, an audit, and release packaging.
- Release assets are built in GitHub Actions from the tagged source.
- GitHub artifact attestations provide build provenance for `main.js`, `manifest.json`, and `styles.css`.
- Runtime code contains no Node.js imports or runtime third-party dependencies.
