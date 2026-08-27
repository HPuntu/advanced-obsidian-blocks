# Releasing

Releases are intentionally automated so the committed metadata, tag, build, and GitHub assets cannot drift apart.

## Automatic releases from `main`

The **Promote release** workflow runs after a push to `main`:

1. It chooses `major`, `minor`, or `patch` from commit messages. The first release keeps the committed version.
2. It synchronises `package.json`, `manifest.json`, and `versions.json`.
3. It runs type checking, linting, tests, a production build, and `npm audit --omit=dev`.
4. It updates `CHANGELOG.md`, commits the release metadata, and creates a version tag without a `v` prefix.
5. It pushes the release commit and tag to `main`.
6. It creates an artifact provenance attestation.
7. It publishes `main.js`, `manifest.json`, and `styles.css` as GitHub release assets.

Use `[minor]`, `#minor`, or a conventional `feat:` commit for a minor release. Use `[major]`, `#major`, or `BREAKING CHANGE` for a major release. All other eligible pushes produce a patch release. Add `[skip release]` for changes that should not publish.

The workflow can also be started manually with an explicit bump choice.

## Repository setup

Under **Settings → Actions → General**, allow GitHub Actions to read and write repository contents. If `main` has branch protection, permit the GitHub Actions bot to create the release metadata commit and tag or adapt the workflow to use a release pull request.

Obsidian requires the release tag to match `manifest.json` exactly and requires `main.js`, `manifest.json`, and `styles.css` as individual release attachments.
