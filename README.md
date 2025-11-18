# 🐘 PG'ditor

A simple, minimalistic, and fast editor to update your Postgres databases.

![](./screenshot.png)

## Features

-   ⚡ Save all your connections locally and switch databases in one click
-   ⚡ Quickly search and filter your tables
-   ⚡ Visualize your data in a few milliseconds
-   ⚡ Easily insert, update, and delete rows
-   ⚡ Free & open-source — built with Svelte and Tauri

### Roadmap (hopefully added soon 😬)

-   Import/export (CSV, SQL and Json)
-   Use LLM for data reconciliation in imports
-   Add context menu for fast actions on cells and rows (copy content, set to NULL, etc.)
-   Keyboard shortcuts

## What it _doesn't_ do (on purpose)

### ❌ Update table schemas

Schema changes (`CREATE TABLE`, `ALTER TABLE`, etc.) should be done through migrations in your codebase. This tool is meant to help you visualize and edit data — not modify your database structure.

### ❌ Support other databases

PG'ditor is intentionally optimized for Postgres. Keeping a narrow focus allows the UI to stay simple, fast, and efficient.

### ❌ Add unrelated features

We’re not trying to be Supabase or provide auth/file storage tooling. PG'ditor focuses on one thing: helping you work with your Postgres data — and doing it well.

## How to try it

There’s no stable release yet, but you can try it locally by cloning the repo and following the setup steps below.

## Setup

```bash
pnpm install
pnpm tauri dev
```
