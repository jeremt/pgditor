<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {getPgContext, type PgColumn} from "../pgContext.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    const pg = getPgContext();
</script>

{#if inlined}
    <MultilinesInput
        id={column.column_name}
        class="font-mono!"
        placeholder={"{}"}
        autocomplete="off"
        autocapitalize="off"
        minRows={1}
        bind:value
    />
{:else}
    <MonacoEditor
        bind:value
        selectedFile="{pg.currentTable!.name}-{column}.json"
        files={[{path: `${pg.currentTable!.name}-${column}.json`, value: ""}]}
        fontFamily="Space Mono"
        fontSize={12}
        showLineNumbers={true}
        onchange={(newValue, path) => {
            if (path === `${pg.currentTable!.name}-${column}.json`) {
                value = newValue;
            } else {
                throw new Error(`File ${path} not found.`);
            }
        }}
    />
{/if}
