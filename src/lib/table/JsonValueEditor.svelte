<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import type {PgColumn, PgRow} from "./tableContext.svelte";

    type Props = {
        column: PgColumn;
        value: string;
    };
    let {column, value = $bindable()}: Props = $props();
</script>

<div class="min-h-40 border border-bg-1 hover:border-bg-2 transition-all">
    <MonacoEditor
        bind:value
        selectedFile="value.json"
        files={[{path: "value.json", value: ""}]}
        fontFamily="Space Mono"
        fontSize={12}
        showLineNumbers={false}
        onchange={(newValue, path) => {
            switch (path) {
                case "value.json":
                    value = newValue;
                    break;
                default:
                    throw new Error(`File ${path} not found.`);
            }
        }}
    />
</div>
<!-- <div class="relative">
        <MultilinesInput
            id={column.column_name}
            class="font-mono!"
            {disabled}
            {placeholder}
            minRows={1}
            bind:value={rowValue.value}
        />
        {#if ["json", "jsonb", "xml"].includes(column.data_type)}
            <button
                class="cursor-pointer absolute top-2 right-2 bg-bg border border-bg-1 rounded-xl text-sm! px-2 py-1"
                onclick={() => (isMonacoOpen = true)}>Edit</button
            >
            <Dialog
                isOpen={isMonacoOpen}
                onrequestclose={() => (isMonacoOpen = false)}
                position="right"
                animation="right"
            >
                <header class="flex gap-4 w-xl pb-2 items-center">
                    <button
                        type="button"
                        class="btn icon ghost"
                        aria-label="Close"
                        onclick={(e) => {
                            isMonacoOpen = false;
                            e.stopPropagation();
                        }}><CrossIcon /></button
                    >
                    <h2 class="flex gap-2">
                        <span>Editing</span>
                        <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1">{column.column_name}</span>
                        <span class="font-normal">{column.data_type}</span>
                    </h2>
                </header>
                <MonacoEditor
                    bind:value={rowValue.value}
                    selectedFile="value.json"
                    files={[{path: "value.json", value: ""}]}
                    fontSize={12}
                    onchange={(value, path) => {
                        switch (path) {
                            case "value.json":
                                rowValue.value = value;
                                break;
                            default:
                                throw new Error(`File ${path} not found.`);
                        }
                    }}
                />
            </Dialog>
        {/if}
    </div> -->
