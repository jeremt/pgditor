<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";
    import {SplitPane} from "@rich_harris/svelte-split-pane";

    let scripts = getScriptsContext();
</script>

<div class="grow overflow-hidden">
    <SplitPane type="rows" id="main" min="100px" max="-100px" pos="50%">
        {#snippet a()}
            <MonacoEditor
                bind:value={scripts.currentScript}
                selectedFile="script.sql"
                files={[{path: "script.sql", value: ""}]}
                fontFamily="Space Mono"
                fontSize={14}
                onchange={(newValue, path) => {
                    switch (path) {
                        case "script.sql":
                            scripts.currentScript = newValue;
                            break;
                        default:
                            throw new Error(`File ${path} not found.`);
                    }
                }}
            />
        {/snippet}

        {#snippet b()}
            <div class="flex border-t border-bg-1 w-full min-h-0 overflow-auto">
                {#if scripts.lastResult === undefined}
                    <div class="text-fg-1 m-auto">
                        No results yet, press <strong>Run query</strong> to execute your query and get results
                    </div>
                {:else if scripts.lastResult.length === 0}
                    <div class="text-fg-1 m-auto">No result, succesfully executed.</div>
                {:else}
                    {@const columns = Object.keys(scripts.lastResult[0])}
                    <table class="h-fit min-h-0">
                        <thead>
                            <tr>
                                {#each columns as column}
                                    <th>{column}</th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody>
                            {#each scripts.lastResult as row}
                                <tr>
                                    {#each columns as column}
                                        <td>{row[column] === null ? "null" : row[column]}</td>
                                    {/each}
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        {/snippet}
    </SplitPane>
</div>
