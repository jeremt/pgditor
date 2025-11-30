<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ClearIcon from "$lib/icons/ClearIcon.svelte";
    import EnterIcon from "$lib/icons/EnterIcon.svelte";
    import JsonFileIcon from "$lib/icons/JsonFileIcon.svelte";
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";

    const scripts = getScriptsContext();

    type FileRow = {name: string; path: string};
    let currentFile = $state<FileRow>({name: "test.sql", path: "~/Downloads"});
    const files: FileRow[] = [
        {name: "test.sql", path: "~/Downloads"},
        {name: "lol.sql", path: "~/Projects/lol/sql"},
    ];

    let isFileSelectOpen = $state(false);
    const itemToString = (item: FileRow) => `${item.name} ${item.path}`;
    const onselect = (item: FileRow) => {
        currentFile = item;
        isFileSelectOpen = false;
        console.log("TODO: select ", item);
    };
</script>

<!-- <button class="btn ghost" title="⌘P" onclick={() => (isFileSelectOpen = true)} disabled={false}>
    {currentFile.name}
</button> -->

<Dialog isOpen={isFileSelectOpen} onrequestclose={() => (isFileSelectOpen = false)} --padding="1rem">
    <ItemSelect items={files} {itemToString} {onselect}>
        {#snippet renderItem(item, index, selectedIndex, highlights)}
            {#if currentFile && itemToString(currentFile) === itemToString(item)}
                <CheckIcon --size="1.2rem" />
            {:else}
                <JsonFileIcon --size="1.2rem" />
            {/if}
            {#if highlights}<span class="search-result">{@html highlights}</span>{:else}{item.name}{/if}
            <span class="font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis">{item.path}</span>
            {#if index === selectedIndex}
                <EnterIcon />
            {/if}
        {/snippet}
    </ItemSelect>
</Dialog>

<button
    class="btn ghost ml-auto"
    disabled={scripts.errorMessage === "" && scripts.lastResult === undefined}
    onclick={() => {
        scripts.errorMessage = "";
        scripts.lastResult = undefined;
    }}><ClearIcon --size="1.2rem" /> Clear output</button
>
<button class="btn" onclick={scripts.run} title="⌘↵"
    ><PlayIcon --size="1.2rem" /> Run {scripts.currentSelection ? "selection" : "file"}</button
>

<style>
    .search-result {
        color: var(--color-fg-2);
        :global(b) {
            color: var(--color-fg);
        }
    }
</style>
