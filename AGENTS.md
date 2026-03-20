# AGENTS.md

This file contains guidelines and instructions for agents working in the pgditor codebase.

## Project Overview

PGditor is a Tauri-based desktop application (Rust backend + SvelteKit frontend) for working with PostgreSQL databases. It features table viewing/editing, SQL scripting, and graph visualization.

## Build Commands

### Running the App

```bash
pnpm tauri dev    # Start Tauri dev environment (always use this)
pnpm tauri build  # Build for production
```

### Type Checking

```bash
pnpm check        # TypeScript/Svelte type checking
pnpm check:watch  # Watch mode for type checking
```

### Backend (Rust/Tauri)

```bash
cd src-tauri
cargo check       # Check for errors without building
cargo build       # Build
cargo test        # Run tests
```

### Testing

```bash
pnpm test                    # Run all tests (vitest)
pnpm test --watch            # Watch mode
pnpm test src/lib/foo.test.ts # Run single test file
```

### Release

```bash
pnpm release <version>  # e.g., pnpm release 0.0.32
```

## Code Style

### General

- **Line length**: Soft limit 100 characters
- **Indentation**: 4 spaces (or configured by project)
- **Semicolons**: Yes
- **Trailing commas**: Yes (in multiline)

### TypeScript/JavaScript

#### Naming Conventions

- **Variables/functions**: `snake_case`
- **Types/interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants, `snake_case` for module-level
- **Files**: `snake_case.svelte.ts`, `snake_case.ts`, `PascalCase.svelte`

#### Imports (SvelteKit)

```typescript
// 1. External libraries
import {something} from "external-lib";

// 2. SvelteKit/framework
import {onMount} from "svelte";

// 3. Tauri APIs
import {invoke} from "@tauri-apps/api/core";

// 4. Internal lib ($lib)
import {get_foo_context} from "$lib/foo/foo_context.svelte";
import FooComponent from "$lib/foo/Foo.svelte";

// 5. Relative imports
import {helper} from "./helper";
```

#### TypeScript

- Use explicit types for function parameters
- Prefer `type` over `interface` for simple type definitions
- Use `satisfies` when type inference is desired
- Use `as const` for literal types
- Export types from `*.svelte.ts` files alongside context functions

#### Svelte 5 Patterns

- Use runes: `$state`, `$props`, `$effect`, `$derived`
- Use `.svelte.ts` files for any code using runes outside a component (state, context, etc.)
- Context files export `get_*_context` and `set_*_context` functions
- Use `onMount` for initialization, `$effect` for reactive side effects
- Use `$derived` for computed values

```typescript
// Context pattern
const key = Symbol();
export const get_my_context = () => getContext<MyContext>(key);
export const set_my_context = () => setContext(key, new MyContext());

// Runes
let count = $state(0);
const doubled = $derived(count * 2);
$effect(() => {
    /* side effect */
});
```

#### Error Handling

- Use `catch_error` wrapper for async operations that may fail
- `catch_error` returns `Result<T, Error>` - check if result is an Error instance
- Never use try/catch for error handling in the frontend
- Example:

```typescript
const result = await catch_error(() => some_async_function());
if (result instanceof Error) {
    // handle error
} else {
    // use result
}
```

### Rust

#### Naming Conventions

- **Modules/functions/variables**: `snake_case`
- **Types/Enums**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Crates**: `kebab-case`

#### Imports

```rust
// Order: std, external crates, local
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

use crate::commands;
use crate::error;
```

#### Error Handling

- Use `Result<T, String>` for Tauri commands (serializable error)
- Use `anyhow::Result<T>` for internal library functions
- Propagate errors with `?` operator
- Use `.map_err(|e| e.to_string())` at Tauri command boundaries

#### Tauri Commands

```rust
#[tauri::command]
pub async fn my_command(app: AppHandle) -> Result<String, String> {
    // ... implementation
    Ok(result)
}
```

### CSS/Tailwind

- Use Tailwind CSS utility classes in components
- Always use theme colors (e.g., `bg-error`, `text-fg`, `bg-bg-0`) - never hardcode hex colors
- Use CSS variables for theming (`var(--color-fg)`, `var(--color-bg)`)
- Use native CSS nesting where needed
- Keep custom styles minimal; prefer utility classes

## Architecture

### Frontend Structure

```
src/
├── routes/           # SvelteKit pages
│   ├── +layout.svelte
│   └── +page.svelte
├── lib/
│   ├── widgets/      # Reusable UI components
│   ├── icons/       # SVG icon components
│   ├── helpers/     # Utility functions
│   ├── [feature]/   # Feature modules (connection, table, graph, etc.)
│   │   ├── *.svelte.ts  # Code using runes (state, context, etc.)
│   │   ├── *.svelte     # Components
│   │   └── ...
```

### State Management

- Svelte 5 Context API for global state
- Each feature has a `*_context.svelte.ts` file
- Use `catch_error` wrapper for async operations with toast notifications

### Backend Structure

```
src-tauri/src/
├── lib.rs           # Tauri builder, menu setup
├── main.rs         # Entry point
├── commands/       # Tauri command handlers
├── error.rs       # Error types
├── pg/            # PostgreSQL integration
└── ai/            # AI integration
```

## Version Management

- Version is stored in `package.json` and `src-tauri/Cargo.toml`
- Run `pnpm release <version>` to update both
- The release script stages and commits both files

## Important Notes

1. **Svelte 5**: This project uses Svelte 5 with runes (`$state`, `$props`, `$effect`)
2. **Tauri 2**: Backend is Tauri 2.x with plugins for dialog, fs, store, sql, clipboard, os
3. **Store Plugin**: Uses `@tauri-apps/plugin-store` for persistent settings storage
