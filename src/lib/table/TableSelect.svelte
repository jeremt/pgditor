<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import EyeIcon from "$lib/icons/EyeIcon.svelte";
    import TableIcon from "$lib/icons/TableIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {fuzzySearchWithHighlights, renderHighlightedMatch} from "$lib/helpers/fuzzySearch";

    import {getTableContext} from "./tableContext.svelte";

    const pgTable = getTableContext();

    let isPopoverOpen = $state(false);

    let searchText = $state("");
    let searchResult = $derived(
        fuzzySearchWithHighlights(
            searchText,
            pgTable.list.map((item) => `${item.schema}.${item.name}`)
        ).map(({item, ranges}) => ({text: item, html: renderHighlightedMatch(item, ranges)}))
    );
</script>

{#snippet icon(type: "BASE TABLE" | "VIEW")}
    {#if type === "BASE TABLE"}
        <TableIcon --size="1.2rem" />
    {:else}
        <EyeIcon --size="1.2rem" />
    {/if}
{/snippet}

<Popover bind:isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost" onclick={() => (isPopoverOpen = !isPopoverOpen)} disabled={!pgTable.current}>
            {#if pgTable.current}
                {@render icon(pgTable.current.type)} {pgTable.current.schema}.{pgTable.current.name}
            {:else}
                no tables
            {/if}
            <ChevronIcon --size="1rem" direction={isPopoverOpen ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2">
        <input type="text" bind:value={searchText} placeholder="Search table" />
        <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
            {#if searchText === ""}
                {#each pgTable.list as table}
                    <button
                        class="btn ghost justify-start!"
                        onclick={() => {
                            pgTable.use(table);
                            isPopoverOpen = false;
                        }}
                    >
                        {@render icon(table.type)}
                        {table.schema}.{table.name}
                    </button>
                {/each}
            {:else}
                {#each searchResult as { text, html }}
                    {@const table = pgTable.list.find((table) => `${table.schema}.${table.name}` === text)}
                    {#if table}
                        <button
                            class="btn ghost justify-start!"
                            onclick={() => {
                                if (table) {
                                    pgTable.use(table);
                                    searchText = "";
                                    isPopoverOpen = false;
                                }
                            }}
                        >
                            {@render icon(table.type)}
                            <span class="search-result">{@html html}</span>
                        </button>
                    {/if}
                {:else}
                    <p class="text-sm text-center text-fg-2">No table found</p>
                {/each}
            {/if}
        </div>
    </div>
</Popover>

<style>
    .search-result {
        color: var(--color-fg-2);
        :global(b) {
            color: var(--color-fg);
        }
    }
</style>
