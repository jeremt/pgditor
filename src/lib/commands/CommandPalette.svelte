<script lang="ts">
    import Dialog from "$lib/widgets/Dialog.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";
    import {get_commands_context, type Command} from "./commands_context.svelte";

    const commands = get_commands_context();
    const item_to_string = (item: Command) => item.title;
    const onselect = (item: Command) => {
        commands.execute(item.title);
        commands.is_command_palette_open = false;
    };
</script>

<Dialog
    is_open={commands.is_command_palette_open}
    onrequestclose={() => (commands.is_command_palette_open = false)}
    --padding="1rem"
>
    <ItemSelect
        items={commands.all}
        {item_to_string}
        {onselect}
        no_items="No commands loaded."
        no_result="No matching commands."
        placeholder="Filter commands"
    >
        {#snippet render_item(item, index, selectedIndex, highlights)}
            <div class="flex flex-col py-2 items-start">
                {#if highlights}
                    <span class="search-result">{@html highlights}</span>
                {:else}
                    {item.title}
                {/if}
                <span class="font-normal text-xs text-fg-1">{item.description}</span>
            </div>
            <span class="ms-auto font-normal font-mono text-fg-1">{item.shortcut}</span>
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
