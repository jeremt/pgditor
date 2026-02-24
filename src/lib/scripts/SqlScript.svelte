<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {get_scripts_context} from "./scripts_context.svelte";
    import {SplitPane} from "@rich_harris/svelte-split-pane";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import {get_pg_context} from "$lib/table/pg_context.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import {get_settings_context} from "$lib/settings/settings_context.svelte";

    const scripts = get_scripts_context();
    const {toast} = get_toast_context();
    const pg = get_pg_context();

    let settings = get_settings_context();
</script>

<div class="grow overflow-hidden">
    <SplitPane type="rows" id="main" min="100px" max="-100px" pos="50%">
        {#snippet a()}
            <MonacoEditor
                bind:value={scripts.current_value}
                bind:selection={scripts.current_selection}
                selected_file="script.sql"
                files={[{path: "script.sql", value: ""}]}
                font_family="Space Mono"
                font_size={14}
                theme={settings.colorScheme}
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
                    <div class="text-error m-auto">
                        SQL Error: {scripts.error_message}
                    </div>
                {:else if pg.is_loading}
                    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
                        <ProgressCircle infinite={true} show_value={false} />
                    </div>
                {:else if scripts.last_result === undefined}
                    <div class="text-fg-1 m-auto">
                        No results yet, press <strong>Run</strong> to execute your query and show results
                    </div>
                {:else if scripts.last_result.length === 0}
                    <div class="text-fg-1 m-auto">No result, succesfully executed.</div>
                {:else}
                    {@const columns = Object.keys(scripts.last_result[0])}
                    <div class="overflow-auto">
                        <table class="h-fit">
                            <thead class="sticky top-0 bg-bg">
                                <tr>
                                    {#each columns.filter((col) => col !== "__index") as column}
                                        <th>{column}</th>
                                    {/each}
                                </tr>
                            </thead>
                            <tbody>
                                {#each scripts.last_result as row (row.__index)}
                                    <tr>
                                        {#each columns.filter((col) => col !== "__index") as column}
                                            <td
                                                title={row[column]}
                                                onclick={async () => {
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
</div>

<style>
    td {
        cursor: pointer;
        transition: 0.1s all;
        &:hover {
            background-color: var(--color-bg-1);
        }
    }
</style>
