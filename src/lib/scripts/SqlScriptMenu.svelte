<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ClearIcon from "$lib/icons/ClearIcon.svelte";
    import EnterIcon from "$lib/icons/EnterIcon.svelte";
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getScriptsContext, type ScriptFile} from "./scriptsContext.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";
    import FileIcon from "$lib/icons/FileIcon.svelte";
    import {open} from "@tauri-apps/plugin-dialog";
    import {getPgContext} from "$lib/table/pgContext.svelte";
    // import TrashIcon from "$lib/icons/TrashIcon.svelte";
    // import PlusIcon from "$lib/icons/PlusIcon.svelte";
    // import SaveIcon from "$lib/icons/SaveIcon.svelte";
    // import SearchIcon from "$lib/icons/SearchIcon.svelte";

    const scripts = getScriptsContext();
    const pg = getPgContext();

    let isFileSelectOpen = $state(false);
    const itemToString = (item: ScriptFile) => item.path;
    const onselect = (item: ScriptFile) => {
        scripts.selectFile(item);
        isFileSelectOpen = false;
    };

    const newScript = () => {
        scripts.emptyFile();
        isFileSelectOpen = false;
    };

    const importScript = async () => {
        const scriptPath = await open({
            multiple: false,
            filters: [
                {
                    name: "Text",
                    extensions: ["sql"],
                },
            ],
        });
        if (scriptPath !== null) {
            scripts.add(scriptPath);
        }
    };
    const lastSlash = (path: string) => {
        let lastIndex = 0;
        let inElement = false;
        for (let i = 0; i < path.length; i++) {
            if (path[i] === "<") {
                inElement = true;
            }
            if (path[i] === ">") {
                inElement = false;
            }
            if (!inElement && path[i] === "/") {
                lastIndex = i;
            }
        }
        return lastIndex;
    };
    const filename = (path: string) => path.slice(lastSlash(path) + 1);
    const folderpath = (path: string) => path.slice(0, lastSlash(path));
</script>

<!-- <button class="btn ghost" title="⌘P" onclick={() => (isFileSelectOpen = true)} disabled={false}>
    {#if scripts.currentFile}
        <FileIcon --size="1.2rem" />
        {filename(scripts.currentFile.path)}
    {:else}
        <SearchIcon --size="1.2rem" />
        Select file
    {/if}
</button>

{#if scripts.currentFile === undefined}
    <button class="btn ghost">
        <SaveIcon --size="1.2rem" />
        Save
    </button>
{/if} -->

<div class="mr-auto"></div>

{#if pg.lastQueryTime !== undefined}
    <div class="ml-auto text-xs text-fg-1">{pg.lastQueryTime.toFixed(0)} ms</div>
{/if}

<button
    class="btn ghost"
    disabled={scripts.errorMessage === "" && scripts.lastResult === undefined}
    onclick={() => {
        scripts.errorMessage = "";
        scripts.lastResult = undefined;
    }}><ClearIcon --size="1.2rem" /> Clear output</button
>
<button class="btn" onclick={scripts.run} title="⌘↵"
    ><PlayIcon --size="1.2rem" /> Run {scripts.currentSelection ? "selection" : "file"}</button
>

<Dialog isOpen={isFileSelectOpen} onrequestclose={() => (isFileSelectOpen = false)} --padding="1rem">
    <ItemSelect items={scripts.files} {itemToString} {onselect} noItems="No scripts imported yet for this database.">
        {#snippet renderAction()}
            {#if scripts.currentFile !== undefined}
                <button class="btn secondary overflow-visible" onclick={newScript}>New</button>
            {/if}
            <button class="btn overflow-visible" onclick={importScript}>Import</button>
        {/snippet}
        {#snippet renderItem(item, index, selectedIndex, highlights)}
            {#if scripts.currentFile && itemToString(scripts.currentFile) === itemToString(item)}
                <CheckIcon --size="1.2rem" />
            {:else}
                <FileIcon --size="1.2rem" />
            {/if}
            {#if highlights}
                <span class="search-result">{@html filename(highlights)}</span>
            {:else}
                {filename(item.path)}
            {/if}
            {#if highlights}
                <span class="search-result font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis">
                    {@html folderpath(highlights)}
                </span>
            {:else}
                <span class="font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis">
                    {folderpath(item.path)}
                </span>
            {/if}
            {#if index === selectedIndex}
                <EnterIcon />
            {/if}
        {/snippet}
    </ItemSelect>
</Dialog>

<style>
    .search-result {
        color: var(--color-fg-2);
        :global(b) {
            color: var(--color-fg);
        }
    }
</style>
