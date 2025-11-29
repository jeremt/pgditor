# 🐘 PG'ditor

A simple, minimalistic, and fast editor to work with your Postgres databases.

![](./screenshot.png)

## Features

-   ⚡ Save all your connections locally and switch databases in one click
-   ⚡ Quickly search and filter your tables
-   ⚡ Visualize your data in a few milliseconds
-   ⚡ Easily insert, update, and delete rows
-   ⚡ Free & open-source — built with Svelte and Tauri

### Priority roadmap (hopefully added soon 😬)

-   Import (CSV, SQL and Json), ideally using LLM to help with table matching/normalization and data reconciliation
-   Add custom monaco editor for easy edit for fields like jsonb
-   Add some customisation features like light mode, font, compact toolbar, etc.

Here is a public link access to the figma : https://www.figma.com/design/aWQAAUrvPCPeo62ykwJ6Dz/pgeditor?node-id=251-193&t=LbJTm8y4i4WAPX7I-1

## What it _doesn't_ do (on purpose)

### ❌ Update table schemas

Schema changes (`CREATE TABLE`, `ALTER TABLE`, etc.) should be done through migrations in your codebase. This tool is meant to help you visualize and edit data — not modify your database structure.

### ❌ Support other databases

PG'ditor is intentionally optimized for Postgres. Keeping a narrow focus allows the UI to stay simple, fast, and efficient.

### ❌ Add unrelated features

We’re not trying to be Supabase or provide auth/file storage tooling. PG'ditor focuses on one thing: helping you work with your Postgres data — and doing it well.

## How to try it

There’s no stable release yet, but you can try it locally by cloning the repo and following the setup steps below.

### Setup

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

### Recommended IDE Setup

-   VS Code : https://code.visualstudio.com/
-   Svelte extension : https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode
-   Tauri extension : https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode
-   rust-analyzer : https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer

### Navigating the codebase

The architecture is intentionally simple:

-   The main UI lives in `src/routes/+page.svelte` (a SPA Svelte app).
-   UI components are in `src/lib/widgets`.
-   Postgres connection logic lives in `src/lib/connection`.
-   Table-editing functionality lives in `src/lib/table`.
-   Icons are added in `src/lib/icons` as svg svelte componenets
-   Random utilities are in `src/lib/helpers`
-   The backend is in `src-tauri/src/lib.rs`, containing commands to store connections locally and interact with the selected Postgres database.

## 🫵 Contribute

Contributions are welcome!

-   🐛 Found a bug? Open an issue with steps to reproduce.
-   💡 Have an idea? Share it in the issues.
-   👯 Want to help build features or improve the code? PRs are welcome!
