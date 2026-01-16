<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import JsonFileIcon from "$lib/icons/JsonFileIcon.svelte";
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getPgContext, type PgColumn, type PgRow} from "./pgContext.svelte";

    type Props = {
        column: PgColumn;
        value: string;
    };
    let {column, value = $bindable()}: Props = $props();

    const pg = getPgContext();
    let isEditorOpen = $state(false);

    let localValue = $derived.by(() => {
        const statedValue = $state($state.snapshot(value)); // recreate a deeply reactive value separated from the prop
        return statedValue;
    });
</script>

<button class="btn secondary w-fit" onclick={() => (isEditorOpen = true)}
    ><JsonFileIcon --size="1.2rem" /> Open json editor</button
>
<Dialog isOpen={isEditorOpen} onrequestclose={() => (isEditorOpen = false)} position="right" animation="right">
    <header class="flex gap-4 w-xl pb-2 items-center">
        <button
            type="button"
            class="btn secondary"
            onclick={(event) => {
                isEditorOpen = false;
                localValue = $state.snapshot(value);
                event.stopPropagation();
            }}>Cancel</button
        >
        <h2 class="flex gap-2">
            <span>Editing</span>
            <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1">{column.column_name}</span>
            <span class="font-normal">{column.data_type}</span>
        </h2>
        <button
            class="btn ml-auto"
            onclick={(event) => {
                isEditorOpen = false;
                value = localValue;
                event.stopPropagation();
            }}><CheckIcon /> Apply</button
        >
    </header>
    <div class="grow border border-bg-1">
        <MonacoEditor
            bind:value={
                () => JSON.stringify(JSON.parse(localValue), null, 4),
                (value) => (localValue = JSON.stringify(JSON.parse(value)))
            }
            selectedFile="{pg.currentTable!.name}-{column}.json"
            files={[{path: `${pg.currentTable!.name}-${column}.json`, value: ""}]}
            fontFamily="Space Mono"
            fontSize={12}
            showLineNumbers={false}
            onchange={(newValue, path) => {
                if (path === `${pg.currentTable!.name}-${column}.json`) {
                    localValue = newValue;
                } else {
                    throw new Error(`File ${path} not found.`);
                }
            }}
        />
    </div>
</Dialog>
