# PGditor

<p align="center">
    <img src="./docs/illustration.png" />
</p>

A simple, minimalistic, and fast editor to work with your Postgres databases.

It's totally free and open-source. Built with performance and efficiency in mind, powered by Tauri (rust) and SvelteKit (ts).

> ⚠️ Even though already usable, the project is still in a every early stage. Expect some bugs and structural changes to the app.

## Why another database manager?

Most database manager try to handle all kind of databases which result in suboptimal implementation for database specific features. Postgres is my favorite database and I'm using it for most my projects. I wanted an editor which properly handle postgres specific features like jsonb or enums, I didn't find any, so I made one 😁

Also, most database managers are very cluttered, I wanted something minimalistic and keyboard friendly with a VSCode-like UX.

## How to try it

You can install it from [the website](https://pgditor-landing.vercel.app), or build it yourself by following the instructions bellow:

### Setup

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Roadmap (hopefully added soon 😬)

Here are some of the features that I'd like to add:

- Import (CSV, SQL and Json), ideally using LLM to help with table matching/normalization and data reconciliation
- Add more customisation features like light mode, font, compact toolbar, etc.
- Transaction mode to handle several modifications at once and validating before executing stuff like delete, insert, update
- Add more specific value editors (for stuffs like dates & timestamps, geo coords, vectors, etc.)
- Graph visualization of the database using something like SvelteFlow

Here is a public link access to the figma : https://www.figma.com/design/aWQAAUrvPCPeo62ykwJ6Dz/pgeditor?node-id=251-193&t=LbJTm8y4i4WAPX7I-1

## What it _doesn't_ do (on purpose)

### ❌ Support other databases

PGditor is intentionally optimized for Postgres. Keeping a narrow focus allows the UI to stay simple, fast, and efficient.

### ❌ Add unrelated features

We’re not trying to be Supabase or provide auth/file storage tooling. PG'ditor focuses on one thing: helping you work with your Postgres data — and doing it well.

### ❌ Update table schemas

For me, schema changes (`CREATE TABLE`, `ALTER TABLE`, etc.) should be done through migrations in your codebase. This tool is meant to help you visualize and edit data — not modify your database structure.

If you really need to do so, I would recommand using the included SQL editor directly.

## 🫵 Contribute

Contributions are welcome!

- 🐛 Found a bug? Open an issue with steps to reproduce.
- 💡 Have an idea? Share it in the issues.
- 👯 Want to help build features or improve the code? PRs are welcome!
