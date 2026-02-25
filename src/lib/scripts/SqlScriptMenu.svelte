<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ClearIcon from "$lib/icons/ClearIcon.svelte";
    import EnterIcon from "$lib/icons/EnterIcon.svelte";
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {get_scripts_context, type ScriptFile} from "./scripts_context.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";
    import FileIcon from "$lib/icons/FileIcon.svelte";
    import {open} from "@tauri-apps/plugin-dialog";
    import {get_pg_context} from "$lib/table/pg_context.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import SaveIcon from "$lib/icons/SaveIcon.svelte";
    import SearchIcon from "$lib/icons/SearchIcon.svelte";
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import ActionButton from "$lib/widgets/ActionButton.svelte";

    const scripts = get_scripts_context();
    const pg = get_pg_context();
    const commands = get_commands_context();

    const item_to_string = (item: ScriptFile) => item.path;
    const onselect = (item: ScriptFile) => {
        scripts.select_file(item);
        commands.is_files_open = false;
    };

    const new_script = () => {
        scripts.empty_file();
        commands.is_files_open = false;
    };

    const import_script = async () => {
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
            scripts.import_file(scriptPath);
        }
    };
    const last_slash = (path: string) => {
        let last_index = 0;
        let in_element = false;
        for (let i = 0; i < path.length; i++) {
            if (path[i] === "<") {
                in_element = true;
            }
            if (path[i] === ">") {
                in_element = false;
            }
            if (!in_element && path[i] === "/") {
                last_index = i;
            }
        }
        return last_index;
    };
    const filename = (path: string) => path.slice(last_slash(path) + 1);
    const folderpath = (path: string) => path.slice(0, last_slash(path));
</script>

<button
    class="btn ghost"
    title="{commands.cmd_or_ctrl}⇧ F"
    onclick={() => (commands.is_files_open = true)}
    disabled={false}
>
    {#if scripts.current_file}
        <FileIcon --size="1.2rem" />
        {filename(scripts.current_file.path)}
    {:else}
        <SearchIcon --size="1.2rem" />
        Select file
    {/if}
</button>

<button class="btn ghost icon" title="Save {commands.cmd_or_ctrl}S" onclick={scripts.save_current_file}>
    <SaveIcon --size="1.2rem" />
</button>

{#if scripts.current_file}
    <ActionButton
        class="btn ghost icon"
        title="Remove"
        confirm={{
            title: "Are you sure?",
            buttonClass: "btn error",
            buttonText: "Remove from editor",
            description:
                "This file will be removed from your tracked files for this database, but won't be deleted from your file system.\nYou can import it again if you want to add it back.",
        }}
        onaction={() => scripts.remove_current_file()}
    >
        <TrashIcon --size="1.2rem" />
    </ActionButton>
{/if}

<div class="mr-auto"></div>

{#if pg.last_query_time !== undefined}
    <div class="ml-auto text-xs text-fg-1">{pg.last_query_time.toFixed(0)} ms</div>
{/if}

<button
    class="btn ghost"
    disabled={scripts.error_message === "" && scripts.last_result === undefined}
    onclick={() => {
        scripts.error_message = "";
        scripts.last_result = undefined;
    }}><ClearIcon --size="1.2rem" /> Clear output</button
>
<button class="btn" onclick={scripts.run} title="{commands.cmd_or_ctrl} ↵"
    ><PlayIcon --size="1rem" /> Run{scripts.current_selection ? " selection" : ""}</button
>

<Dialog is_open={commands.is_files_open} onrequestclose={() => (commands.is_files_open = false)} --padding="1rem">
    <ItemSelect items={scripts.files} {item_to_string} {onselect} no_items="No scripts imported yet for this database.">
        {#snippet render_action()}
            {#if scripts.current_file !== undefined}
                <button class="btn secondary overflow-visible" onclick={new_script}>New</button>
            {/if}
            <button class="btn overflow-visible" onclick={import_script}>Import</button>
        {/snippet}
        {#snippet render_item(item, index, selectedIndex, highlights)}
            {#if scripts.current_file && item_to_string(scripts.current_file) === item_to_string(item)}
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
                <span
                    class="py-2 search-result font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis"
                >
                    {@html folderpath(highlights)}
                </span>
            {:else}
                <span class="py-2 font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis">
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
