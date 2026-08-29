# Changelog

## Unreleased

## 0.2.1 - 2026-08-29

- Restored the registered community-directory ID `fenced-blocks` across the manifest and release tooling.
- Removed a redundant CSS declaration reported as partially supported by the community review scanner.
- Clarified that vault enumeration occurs only during an explicitly requested fence rename.

## 0.2.0 - 2026-08-28

- Renamed the public plugin to Advanced Markdown Blocks while retaining the registered community-directory ID `fenced-blocks`.
- Made fence autocomplete Tab-first and added visual style previews to autocomplete, the style picker, and settings.
- Added editor-action regression coverage for paragraph wrapping, selections, and nested blocks.

## 0.1.0 - 2026-08-27

- Established the complete Advanced Markdown Blocks foundation.
- Added nested `:::name … :::` parsing for Live Preview and Reading View.
- Added six presets, visual settings, editor commands, autocomplete, context actions, import/export, and safe vault-wide renaming.
- Added strict validation, tests, CI, automated semantic releases, and build provenance.
