<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";

    let scripts = getScriptsContext();
</script>

<div class="grow">
    <div class="h-1/2">
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
    </div>
    <div class="h-1/2 border-t border-bg-1 w-full overflow-x-auto">
        {#if scripts.lastResult === undefined}
            <div>No results yet, press <strong>Run query</strong> to execute your query and get results</div>
        {:else if scripts.lastResult.length === 0}
            <div>No result, succesfully executed.</div>
        {:else}
            {@const columns = Object.keys(scripts.lastResult[0])}
            <table>
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
</div>
