# Contributing

Contributions are welcome when they preserve Advanced Markdown Blocks' narrow product boundary: reusable visual `:::name` blocks with a low-friction Obsidian-native interface.

## Local checks

Use Node.js 20.19 or newer.

```bash
npm ci
npm run check
npm run package
```

Pull requests should include tests for parser, settings, or CSS-safety changes. Do not add telemetry, runtime dependencies, network access, process execution, dynamic code evaluation, or direct filesystem access. Use Obsidian's public vault APIs for vault content.

## Commit messages

The release workflow follows conventional commit intent:

- `feat:` or `[minor]` produces a minor release.
- `BREAKING CHANGE`, `[major]`, or `#major` produces a major release.
- Other changes produce a patch release.
- `[skip release]` prevents a release for that push.

Every push to `main` is otherwise eligible for an automated release after CI checks pass.
