<script lang="ts">
    import Dialog from "$lib/widgets/Dialog.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";
    import {getCommandsContext, type Command} from "./commandsContext.svelte";

    const commands = getCommandsContext();
    const itemToString = (item: Command) => item.title;
    const onselect = (item: Command) => {
        commands.execute(item.title);
        commands.isCommandPaletteOpen = false;
    };
</script>

<Dialog
    isOpen={commands.isCommandPaletteOpen}
    onrequestclose={() => (commands.isCommandPaletteOpen = false)}
    --padding="1rem"
>
    <ItemSelect
        items={commands.all}
        {itemToString}
        {onselect}
        noItems="No commands loaded."
        noResult="No matching commands."
        placeholder="Filter commands"
    >
        {#snippet renderItem(item, index, selectedIndex, highlights)}
            <div class="flex flex-col py-2 items-start">
                {#if highlights}
                    <span class="search-result">{@html highlights}</span>
                {:else}
                    {item.title}
                {/if}
                <span class="font-normal text-xs text-fg-1">{item.description}</span>
            </div>
            <span class="ms-auto font-normal font-mono text-fg-1">{item.prettyKeys}</span>
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
