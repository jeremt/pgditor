<script lang="ts">
    import Dialog from "$lib/widgets/Dialog.svelte";
    import ItemSelect from "$lib/widgets/ItemSelect.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import EnterIcon from "$lib/icons/EnterIcon.svelte";
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import {get_query_generator_context, type OpenRouterModel} from "./query_generator_context.svelte";

    const query_generator = get_query_generator_context();

    let {class: className}: {class?: string} = $props();

    let is_open = $state(false);

    const item_to_string = (item: OpenRouterModel) => (item.name === item.id ? item.id : `${item.name} (${item.id})`);

    const onselect = (item: OpenRouterModel) => {
        query_generator.model = item.id;
        query_generator.save_model();
        is_open = false;
    };

    const open = () => {
        is_open = true;
        if (query_generator.openrouter_models.length === 0) query_generator.fetch_openrouter_models();
    };
</script>

<button class="btn ghost justify-start! {className}" type="button" title={query_generator.model} onclick={open}>
    <SparklesIcon --size="1rem" />
    <span class="truncate">{query_generator.model}</span>
</button>

<Dialog is_open={is_open} onrequestclose={() => (is_open = false)} --padding="1rem">
    <ItemSelect
        items={query_generator.openrouter_models}
        {item_to_string}
        {onselect}
        placeholder="Search models…"
        no_items={query_generator.is_loading_openrouter_models
            ? "Loading models…"
            : "No models with tool calling support found"}
        no_result="No model found"
    >
        {#snippet render_item(item, index, selectedIndex, highlights)}
            {#if item.id === query_generator.model}
                <CheckIcon --size="1.2rem" />
            {:else}
                <SparklesIcon --size="1.2rem" />
            {/if}
            {#if highlights}
                <span class="search-result">{@html highlights}</span>
            {:else}
                {item_to_string(item)}
            {/if}
            {#if item.context_length}
                <span class="py-2 font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis">
                    {item.context_length.toLocaleString()} tokens
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
