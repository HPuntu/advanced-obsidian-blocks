# Security policy

## Supported versions

Security fixes are made against the latest release.

## Reporting

Please report a vulnerability privately through GitHub's security advisory interface when available. Do not include private vault content in a public issue.

## Runtime boundary

Fenced Blocks is offline-only. It makes no network requests, starts no processes, opens no sockets, uses no telemetry, and has no runtime package dependencies.

The plugin stores its settings through Obsidian's plugin data API. The only note-writing operation is **Rename in vault**, which the user must explicitly invoke. That operation processes Markdown files through Obsidian's vault API and replaces exact opening fences outside code blocks and Obsidian comments. It never deletes files.

Advanced CSS is restricted to declarations. Selectors, braces, `@` rules, network-loading `url(...)`, script-like values, and legacy executable CSS properties are discarded.
