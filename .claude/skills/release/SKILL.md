---
name: release
description: Cut a new PGditor release - summarize the commits since the last tag into CHANGELOG.md, then bump the version, commit, tag and push. Use when the user asks to release, ship, publish, cut a version, or update the changelog for a release.
---

# Release PGditor

Write the changelog entry for the new version, then hand off to `pnpm release <version>`,
which bumps every version file, verifies them, commits, tags and pushes.

`release.js` refuses to run without a `## <version>` section in `CHANGELOG.md`, so the
changelog always comes first.

## 1. Collect the commits

```bash
git fetch origin --tags
git describe --tags --abbrev=0        # last released tag, e.g. v0.1.4
git log <last-tag>..HEAD --oneline
```

If a commit subject is too terse to tell what changed for a user, look at the diff:

```bash
git show --stat <sha>
```

Skip commits that change nothing for users: CI fixes, refactors with no visible effect,
`release: vX.Y.Z` commits, formatting. If *everything* since the last tag is invisible to
users, say so and ask whether a release is still wanted.

## 2. Pick the version

Current version is in `package.json`. Suggest a bump and let the user confirm, unless they
already gave a number:

- **patch** (0.1.4 → 0.1.5) — fixes and small tweaks only
- **minor** (0.1.4 → 0.2.0) — new user-facing features
- **major** — reserved for breaking changes; PGditor is pre-1.0, so don't suggest it

## 3. Write the entry

Prepend the new section to `CHANGELOG.md`, right under the `# Changelog` title, so versions
read newest first. Create the file with that title if it doesn't exist yet.

```md
## 0.1.5 — 2026-09-23

### Added

- Export the schema graph as a D2 diagram from the graph menu
- Export the schema graph as a PNG image

### Fixed

- Match the system UI color scheme instead of always rendering dark
```

Rules for the entry:

- Heading is `## <version> — <YYYY-MM-DD>` (em dash), no `v` prefix. `release.js` looks for
  this exact heading, and the date is today's.
- Group under `### Added`, `### Changed`, `### Fixed`, `### Removed`. Omit empty groups.
- One line per user-visible change, written for someone using the app, not reading the diff.
  "Refresh a cell's value from the database", not "add refresh functionality to
  table_context".
- Start with a verb, no trailing period, no commit hashes.
- Merge several commits into one line when they're one feature; split one commit into
  several lines when it shipped unrelated things.

Show the entry to the user and get their approval before releasing — this is the text that
ends up public.

## 4. Release

```bash
git push                    # release.js requires main to match origin/main
pnpm release <version>
```

Leave `CHANGELOG.md` uncommitted: `release.js` stages it alongside `package.json`,
`src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` in the `release: vX.Y.Z` commit, then tags
and pushes. The tag push triggers `.github/workflows/release.yml`, which builds the macOS,
Linux and Windows bundles and publishes a prerelease.

Stop and report if `release.js` fails a precondition — don't work around its checks.

Afterwards, give the user the run link:

```bash
gh run list --workflow=release.yml --limit 1
```
