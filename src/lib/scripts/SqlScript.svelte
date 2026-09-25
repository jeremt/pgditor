<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {get_scripts_context} from "./scripts_context.svelte";
    import {SplitPane} from "@rich_harris/svelte-split-pane";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import {get_pg_context} from "$lib/table/pg_context.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import {get_query_generator_context} from "./query_generator/query_generator_context.svelte";
    import {editor} from "monaco-editor";
    import GenerateQuery from "./query_generator/GenerateQuery.svelte";

    const scripts = get_scripts_context();
    const {toast} = get_toast_context();
    const pg = get_pg_context();

    const settings = get_settings_context();
    const query_generator = get_query_generator_context();

    // what the current drag extends: a rectangle of cells, or whole columns from the header
    let drag_mode = $state<"cells" | "columns">();
    // clicking an already selected cell (or column) without dragging clears the selection
    let deselect_on_release = false;

    const start_selection = (event: MouseEvent, row: number, column: number) => {
        if (event.button !== 0) {
            return;
        }
        // prevent the native text selection while dragging
        event.preventDefault();
        if (event.shiftKey && scripts.selection) {
            scripts.selection.focus = {row, column};
        } else {
            deselect_on_release = scripts.is_cell_selected(row, column);
            scripts.selection = {anchor: {row, column}, focus: {row, column}};
        }
        drag_mode = "cells";
    };

    const start_column_selection = (event: MouseEvent, column: number) => {
        if (event.button !== 0 || !scripts.last_result) {
            return;
        }
        event.preventDefault();
        const last_row = scripts.last_result.length - 1;
        if (event.shiftKey && scripts.selection) {
            scripts.selection = {
                anchor: {row: 0, column: scripts.selection.anchor.column},
                focus: {row: last_row, column},
            };
        } else {
            deselect_on_release = scripts.is_cell_selected(0, column) && scripts.is_cell_selected(last_row, column);
            scripts.selection = {anchor: {row: 0, column}, focus: {row: last_row, column}};
        }
        drag_mode = "columns";
    };

    const extend_selection = (row: number, column: number) => {
        if (drag_mode === "cells" && scripts.selection) {
            deselect_on_release = false;
            scripts.selection.focus = {row, column};
        }
    };

    const extend_column_selection = (column: number) => {
        if (drag_mode === "columns" && scripts.selection) {
            deselect_on_release = false;
            scripts.selection.focus.column = column;
        }
    };
</script>

<svelte:window
    onmouseup={() => {
        if (drag_mode !== undefined && deselect_on_release) {
            scripts.selection = undefined;
        }
        deselect_on_release = false;
        drag_mode = undefined;
    }}
    onkeydown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
            scripts.selection = undefined;
        }
    }}
/>

{#snippet main()}
    <SplitPane type="rows" id="main" min="100px" max="-100px" pos="50%">
        {#snippet a()}
            <MonacoEditor
                bind:value={scripts.current_value}
                bind:selection={scripts.current_selection}
                selected_file="script.sql"
                files={[{path: "script.sql", value: ""}]}
                font_family="Space Mono"
                font_size={14}
                theme={settings.color_scheme}
                onrun={scripts.run}
                onsave={scripts.save_current_file}
                onchange={(newValue, path) => {
                    switch (path) {
                        case "script.sql":
                            scripts.current_value = newValue;
                            break;
                        default:
                            throw new Error(`File ${path} not found.`);
                    }
                }}
            />
        {/snippet}

        {#snippet b()}
            <div class="flex border-t border-bg-1 w-full min-h-0 overflow-auto">
                {#if scripts.error_message !== ""}
                    <div class="text-error m-auto p-4 text-center">
                        SQL Error: {scripts.error_message}
                    </div>
                {:else if pg.is_loading}
                    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
                        <ProgressCircle infinite={true} show_value={false} />
                    </div>
                {:else if scripts.last_result === undefined}
                    <div class="text-fg-1 m-auto p-4 text-center">
                        No results yet, press <strong>Run</strong> to execute your query and show results
                    </div>
                {:else if scripts.last_result.length === 0}
                    <div class="text-fg-1 m-auto p-4 text-center">No result, succesfully executed.</div>
                {:else}
                    <div class="overflow-auto">
                        <table class="h-fit">
                            <thead class="sticky top-0 bg-bg">
                                <tr>
                                    {#each scripts.result_columns as column, column_index}
                                        <th
                                            onmousedown={(event) => start_column_selection(event, column_index)}
                                            onmouseenter={() => extend_column_selection(column_index)}>{column}</th
                                        >
                                    {/each}
                                </tr>
                            </thead>
                            <tbody>
                                {#each scripts.last_result as row, row_index (row.__index)}
                                    <tr>
                                        {#each scripts.result_columns as column, column_index}
                                            <td
                                                title={row[column]}
                                                class:selected={scripts.is_cell_selected(row_index, column_index)}
                                                onmousedown={(event) => start_selection(event, row_index, column_index)}
                                                onmouseenter={() => extend_selection(row_index, column_index)}
                                                ondblclick={async () => {
                                                    await writeText(row[column] === null ? "null" : row[column]);
                                                    toast(`Copied ${column}[${row.__index}] to clipboard`);
                                                }}>{row[column] === null ? "null" : row[column].slice(0, 50)}</td
                                            >
                                        {/each}
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>
        {/snippet}
    </SplitPane>
{/snippet}

<div class="grow overflow-hidden">
    {#if query_generator.is_open}
        <SplitPane type="columns" id="main" min="400px" max="-300px" pos="70%">
            {#snippet a()}
                {@render main()}
            {/snippet}
            {#snippet b()}
                <div class="border-s border-t border-bg-1"><GenerateQuery /></div>
            {/snippet}
        </SplitPane>
    {:else}
        {@render main()}
    {/if}
</div>

<style>
    th,
    td {
        cursor: cell;
        user-select: none;
    }
    td {
        &:hover {
            background-color: var(--color-bg-1);
        }
        &.selected {
            background-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
        }
    }
</style>
