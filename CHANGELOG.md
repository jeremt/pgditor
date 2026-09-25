# Changelog

## 0.2.0 — 2026-09-25

### Added

- Select cells in SQL script results by clicking, dragging a rectangle, shift+clicking or clicking column headers
- Copy or export SQL script results, or just the selected cells, as JSON, CSV or SQL
- Delete only the filtered rows or the selected rows of a table
- Pick any OpenRouter model for the AI query builder

### Changed

- Select a SQL script result cell on click instead of copying it; double-click copies a value
- Use OpenRouter instead of OpenAI for the AI query builder

### Fixed

- Show the filtered row count and pagination when filters are applied
- Stop duplicating columns of tables with composite foreign keys
- Escape commas and quotes when copying selected table rows as CSV

## 0.1.5 — 2026-09-23

### Added

- Export the schema graph as a D2 diagram from the graph menu
- Export the schema graph as a PNG image
- Refresh a table cell's value from the database

### Changed

- Disable spellcheck on all text inputs

### Fixed

- Match native UI elements like scrollbars to the app's dark/light theme

## 0.1.1 — 2026-05-21

### Fixed

- Fix filtering on UUID columns, which was broken

## 0.1.0 — 2026-05-21

### Changed

- Update the app icons

### Fixed

- Fix the order of export format options
- Fix a bug when deleting a row selection

## 0.0.33 — 2026-04-04

### Added

- Add a setting to hide views from the tables list

### Changed

- Edit short text values in a popover instead of a dialog
- Improve fuzzy search ranking accuracy
- Update the app icon design and remove unused mobile icons
- Replace the multiline text input with a dedicated SQL textarea for a better editing experience

### Fixed

- Fix the SQL editor occasionally resetting its content

## 0.0.32 — 2026-03-21

### Added

- Add multiple window support
- Add a schema selector to filter tables and the graph by schema
- Add an option to hide system tables and schemas (pg_toast, pg_temp) from listings
- Add a settings button to the AI chat interface

### Changed

- Highlight search matches in results
- Prioritize the `public` schema in schema and table ordering
- Improve row export to JSON, CSV and SQL, including exporting only filtered rows
- Rework the table value update dialog and popover

### Fixed

- Fix exporting all rows instead of only the current page
- Fix the update dialog's position when resizing the window
- Fix foreign key display across schemas

## 0.0.31 — 2026-03-18

### Added

- Add an AI chat history that persists across sessions
- Add a tool for the AI assistant to select and export table rows
- Highlight SQL and JSON in the AI chat

### Changed

- Batch multiple queries together and show clearer progress in the AI tool calls UI
- Show a richer list of available AI models
- Show the current connection and table in the window title

### Fixed

- Fix running more than one query at once from a raw query
- Fix the JSON preview validity check
- Fix the selected reasoning option and model not being applied correctly

## 0.0.30 — 2026-03-10

### Added

- Add an AI assistant that can inspect the schema and generate/run SQL queries on request
- Add AI settings to configure the assistant

### Changed

- Keep the API key private
- Improve the AI assistant's prompt and add a dedicated UI for its SQL queries
- Support secure TLS connections when the AI assistant runs a query

## 0.0.29 — 2026-03-05

### Changed

- Switch to a lighter Mapbox style for geometry/geography previews
- Clean up and improve keyboard shortcut handling
- Show clearer error messages for invalid connection strings

### Fixed

- Fix a bug when clicking to edit a geometry value

## 0.0.28 — 2026-02-25

### Fixed

- Fix maps still not loading in release builds (typo in the Mapbox token env var)

## 0.0.27 — 2026-02-25

### Fixed

- Fix maps not loading in release builds (missing Mapbox token)

## 0.0.26 — 2026-02-25

### Added

- Click a foreign key value directly in the table to jump to it
- Use Mapbox for geometry and geography value editors

### Changed

- Order tables alphabetically

### Fixed

- Fix handling of very large JSON values

## 0.0.25 — 2026-02-16

### Added

- Add an interactive schema graph visualization, with automatic layout and a minimap

### Fixed

- Fix scrolling in the foreign key editor
- Fix scrolling on empty tables

## 0.0.24 — 2026-02-10

### Added

- Add support for the geometry column type

### Fixed

- Fix error handling when updating a table value

## 0.0.23 — 2026-02-09

### Added

- Add support for numeric types, UUID columns and a dedicated date value editor
- Add basic support for PostGIS types
- Properly handle `now()` and `null` default values
- Add a colorscheme command and a button to open the command palette

### Changed

- Copy values instead of updating them when editing rows from a view
- Remove the Cmd+F shortcut, which conflicted with the SQL editor's search

### Fixed

- Fix a crash when a point value is empty

## 0.0.22 — 2026-02-06

### Added

- Add a "select all columns" action
- Show a distinct color for null values

### Changed

- Small theme improvements

## 0.0.21 — 2026-02-03

### Added

- Show the column type in the column header

### Changed

- Smarter, more capable filters

### Fixed

- Fix `is null` filters

## 0.0.20 — 2026-01-30

### Added

- Add a foreign key value editor
- Add light mode

### Changed

- Better handling of rows without a primary key
- Apply the color scheme to the SQL editor
- More accurate query duration reporting
- Support shift-click range selection
- Add simple filters to the foreign key editor

### Fixed

- Wait for the app to be ready before showing the window, avoiding a flash
- Fix error handling on insert
- Fix ordering by a computed/case column
- Fix clicking a foreign key value

## 0.0.19 — 2026-01-27

### Fixed

- Fix the macOS Intel build

## 0.0.17 — 2026-01-26

### Added

- Allow hiding columns
- Allow cascading when truncating a table

### Changed

- Fix the toolbar layout
- Small UI improvements to scripts

## 0.0.16 — 2026-01-25

### Added

- Add a loading state for running SQL queries
- Add "update row" to the context menu
- Add a command palette
- Add platform-aware keyboard shortcuts (Cmd vs Ctrl)
- Save SQL scripts
- Copy and edit the underlying SQL when updating a table value
- Allow raw `WHERE` statements in filters
- Truncate a table (restarting identity) when deleting with no rows selected

### Changed

- Update rows via a single cell by default, with snappier animations
- Sort by the primary key by default when available
- Improve fuzzy search result ranking
- Mask the connection string input like a password field
- Accessibility improvements, including for select dropdowns

### Fixed

- Update rows using the primary key instead of `ctid`, for more reliable updates
- Fix inserting default text values
- Fix the internal row index leaking into raw SQL query results
- Preserve column order in raw query results
- Fix arrow-key navigation while searching for tables
- Fix views visualization
- Fix the popover closing unexpectedly on focus out

## 0.0.13 — 2026-01-14

### Added

- Add a build for older macOS versions (Intel)

## 0.0.12 — 2026-01-10

### Added

- Add basic autocomplete to the SQL editor
- Add a resizable split pane for the SQL script editor

### Changed

- Improve JSON value editing and clean up the Monaco-based editors
- Better error handling when a connection fails
- Properly handle database views
- Automatically select the last used table when possible

### Fixed

- Fix quotes in filters
- Fix scrolling and cell copy in the SQL script editor
- Fix table borders
- Fix nested dialogs closing unexpectedly
- Fix multiline input height in some cases
- Refresh should also refresh the data

## 0.0.10 — 2025-11-29

### Added

- Add a basic SQL query runner (without autocomplete)
- Add a Monaco-based editor for JSON values
- Add an empty state for tables with no rows
- Allow reordering columns

### Changed

- Show column names in the table selector

### Fixed

- Fix the global shortcut registration
- Fix auto-scroll and icon sizing in the table selector

## 0.0.9 — 2025-11-23

### Added

- Add a custom placeholder for filters

### Fixed

- Fix filtering on non-text values
- Clean up shortcut registration

## 0.0.5 — 2025-11-22

### Fixed

- Fix insert and visual bugs

## 0.0.1 — 2025-11-21

Initial release.

### Added

- Connect to a Postgres database via a connection string, remembering the last used connection
- List and browse tables, with visualization of rows and columns
- Insert, update and delete rows, with a confirmation step before deleting
- Filter rows, with support for limit/offset and column listing
- Handle null, boolean and enum values properly
- Jump to a row's foreign key
- Copy a value or a full row as JSON via the context menu
- Export table data
- Global keyboard shortcuts
- Toast notifications for user feedback
