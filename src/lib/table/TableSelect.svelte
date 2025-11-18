<script lang="ts">
    import EyeIcon from "$lib/icons/EyeIcon.svelte";
    import TableIcon from "$lib/icons/TableIcon.svelte";
    import {fuzzySearchWithHighlights, renderHighlightedMatch} from "$lib/helpers/fuzzySearch";

    import {getTableContext} from "./tableContext.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    const pgTable = getTableContext();

    let isDialogOpen = $state(false);

    let searchText = $state("");
    let searchResult = $derived(
        fuzzySearchWithHighlights(
            searchText,
            pgTable.list.map((item) => `${item.schema}.${item.name}`)
        ).map(({item, ranges}) => ({text: item, html: renderHighlightedMatch(item, ranges)}))
    );

    let selectedIndex = $state(0);
    const handleKeys = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            const table =
                searchText === ""
                    ? pgTable.list[selectedIndex]
                    : pgTable.list.find(
                          (table) => `${table.schema}.${table.name}` === searchResult[selectedIndex].text
                      );
            if (table) {
                pgTable.use(table);
                searchText = "";
                isDialogOpen = false;
            }
        } else if (event.key === "ArrowUp" && selectedIndex > 0) {
            selectedIndex -= 1;
        } else if (
            event.key === "ArrowDown" &&
            selectedIndex < (searchText === "" ? pgTable.list.length : searchResult.length)
        ) {
            selectedIndex += 1;
        } else {
            selectedIndex = 0;
        }
    };
</script>

{#snippet icon(type: "BASE TABLE" | "VIEW")}
    {#if type === "BASE TABLE"}
        <TableIcon --size="1.2rem" />
    {:else}
        <EyeIcon --size="1.2rem" />
    {/if}
{/snippet}

<button class="btn ghost" onclick={() => (isDialogOpen = true)} disabled={!pgTable.current}>
    {#if pgTable.current}
        {@render icon(pgTable.current.type)} {pgTable.current.schema}.{pgTable.current.name}
    {:else}
        no tables
    {/if}
</button>

<Dialog isOpen={isDialogOpen} onrequestclose={() => (isDialogOpen = false)}>
    <div class="flex flex-col gap-2 w-2xl">
        <input
            type="text"
            bind:value={searchText}
            onkeydown={handleKeys}
            autocorrect="off"
            placeholder="Search table"
        />
        <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
            {#if searchText === ""}
                {#each pgTable.list as table, i}
                    <button
                        class="btn ghost justify-start!"
                        class:selected-table={i === selectedIndex}
                        onclick={() => {
                            pgTable.use(table);
                            isDialogOpen = false;
                        }}
                    >
                        {@render icon(table.type)}
                        {table.schema}.{table.name}
                        {#if pgTable.current && `${table.schema}.${table.name}` === `${pgTable?.current.schema}.${pgTable?.current.name}`}
                            <span class="text-fg-1 font-normal ml-auto">current</span>
                        {/if}
                    </button>
                {/each}
            {:else}
                {#each searchResult as { text, html }, i}
                    {@const table = pgTable.list.find((table) => `${table.schema}.${table.name}` === text)}
                    {#if table}
                        <button
                            class="btn ghost justify-start!"
                            class:selected-table={i === selectedIndex}
                            onclick={() => {
                                if (table) {
                                    pgTable.use(table);
                                    searchText = "";
                                    isDialogOpen = false;
                                }
                            }}
                        >
                            {@render icon(table.type)}
                            <span class="search-result">{@html html}</span>
                            {#if pgTable.current && text === `${pgTable.current.schema}.${pgTable.current.name}`}
                                <span class="ml-auto text-fg-1 font-normal">current</span>
                            {/if}
                        </button>
                    {/if}
                {:else}
                    <p class="text-sm text-center text-fg-2">No table found</p>
                {/each}
            {/if}
        </div>
    </div>
</Dialog>

<style>
    .search-result {
        color: var(--color-fg-2);
        :global(b) {
            color: var(--color-fg);
        }
    }
    .selected-table {
        background-color: var(--color-bg-1) !important;
    }
</style>
