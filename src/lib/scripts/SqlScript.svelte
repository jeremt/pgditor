<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {getScriptsContext} from "./scriptsContext.svelte";
    import {SplitPane} from "@rich_harris/svelte-split-pane";
    import {getToastContext} from "$lib/widgets/Toaster.svelte";
    import {getPgContext} from "$lib/table/pgContext.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";

    const scripts = getScriptsContext();
    const {toast} = getToastContext();
    const pg = getPgContext();
</script>

<div class="grow overflow-hidden">
    <SplitPane type="rows" id="main" min="100px" max="-100px" pos="50%">
        {#snippet a()}
            <MonacoEditor
                bind:value={scripts.currentValue}
                bind:selection={scripts.currentSelection}
                selectedFile="script.sql"
                files={[{path: "script.sql", value: ""}]}
                fontFamily="Space Mono"
                fontSize={14}
                onrun={scripts.run}
                onchange={(newValue, path) => {
                    switch (path) {
                        case "script.sql":
                            scripts.currentValue = newValue;
                            break;
                        default:
                            throw new Error(`File ${path} not found.`);
                    }
                }}
            />
        {/snippet}

        {#snippet b()}
            <div class="flex border-t border-bg-1 w-full min-h-0 overflow-auto">
                {#if scripts.errorMessage !== ""}
                    <div class="text-error m-auto">
                        SQL Error: {scripts.errorMessage}
                    </div>
                {:else if pg.isLoading}
                    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
                        <ProgressCircle infinite={true} showValue={false} />
                    </div>
                {:else if scripts.lastResult === undefined}
                    <div class="text-fg-1 m-auto">
                        No results yet, press <strong>Run query</strong> to execute your query and get results
                    </div>
                {:else if scripts.lastResult.length === 0}
                    <div class="text-fg-1 m-auto">No result, succesfully executed.</div>
                {:else}
                    {@const columns = Object.keys(scripts.lastResult[0])}
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
                                {#each scripts.lastResult as row (row.__index)}
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
