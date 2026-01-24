<script lang="ts">
    import EyeIcon from "$lib/icons/EyeIcon.svelte";
    import TableIcon from "$lib/icons/TableIcon.svelte";
    import {fuzzySearchWithHighlights, renderHighlightedMatch} from "$lib/helpers/fuzzySearch";

    import {getPgContext} from "./pgContext.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import EnterIcon from "$lib/icons/EnterIcon.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";

    const pg = getPgContext();

    let searchText = $state("");
    let searchResult = $derived(
        fuzzySearchWithHighlights(
            searchText,
            pg.tables.map((item) => `${item.schema}.${item.name}`),
        ).map(({item, ranges}) => ({text: item, html: renderHighlightedMatch(item, ranges)})),
    );

    let selectedIndex = $state(0);
    let buttonRefs = $state<HTMLButtonElement[]>([]);

    $effect(() => {
        if (buttonRefs[selectedIndex]) {
            buttonRefs[selectedIndex].scrollIntoView({
                behavior: "instant",
                block: "nearest",
            });
        }
    });

    const handleKeys = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            const table =
                searchText === ""
                    ? pg.tables[selectedIndex]
                    : pg.tables.find((table) => `${table.schema}.${table.name}` === searchResult[selectedIndex].text);
            if (table) {
                pg.use(table);
                searchText = "";
                pg.isUseDialogOpen = false;
            }
        } else if (event.key === "ArrowUp") {
            selectedIndex =
                selectedIndex === 0
                    ? (searchText === "" ? pg.tables.length : searchResult.length) - 1
                    : selectedIndex - 1;
        } else if (
            event.key === "ArrowDown" &&
            selectedIndex + 1 < (searchText === "" ? pg.tables.length : searchResult.length)
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

<button class="btn ghost" title="⌘T" onclick={() => (pg.isUseDialogOpen = true)} disabled={!pg.currentTable}>
    {#if pg.currentTable}
        {@render icon(pg.currentTable.type)} {pg.currentTable.schema}.{pg.currentTable.name}
    {:else}
        no tables
    {/if}
</button>

<Dialog isOpen={pg.isUseDialogOpen} onrequestclose={() => (pg.isUseDialogOpen = false)} --padding="1rem">
    <div class="flex flex-col gap-2 w-2xl overflow-hidden">
        <input
            type="text"
            bind:value={searchText}
            onkeydown={handleKeys}
            autocorrect="off"
            placeholder="Filter tables by name and schema"
        />
        <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
            {#if searchText === ""}
                {#each pg.tables as table, i}
                    <button
                        bind:this={buttonRefs[i]}
                        class="btn ghost justify-start!"
                        class:selected-table={i === selectedIndex}
                        onclick={() => {
                            pg.use(table);
                            pg.isUseDialogOpen = false;
                        }}
                    >
                        {#if pg.currentTable && `${table.schema}.${table.name}` === `${pg.currentTable.schema}.${pg.currentTable.name}`}
                            <CheckIcon --size="1.2rem" />
                        {:else}
                            {@render icon(table.type)}
                        {/if}
                        <span>{table.schema}.{table.name}</span>
                        {#if i === selectedIndex}
                            <span class="font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis"
                                >{table.column_names.join(", ")}</span
                            >
                            <EnterIcon />
                        {/if}
                    </button>
                {/each}
            {:else}
                {#each searchResult as { text, html }, i}
                    {@const table = pg.tables.find((table) => `${table.schema}.${table.name}` === text)}
                    {#if table}
                        <button
                            bind:this={buttonRefs[i]}
                            class="btn ghost justify-start!"
                            class:selected-table={i === selectedIndex}
                            onclick={() => {
                                if (table) {
                                    pg.use(table);
                                    searchText = "";
                                    pg.isUseDialogOpen = false;
                                }
                            }}
                        >
                            {#if pg.currentTable && text === `${pg.currentTable.schema}.${pg.currentTable.name}`}
                                <CheckIcon --size="1.2rem" />
                            {:else}
                                {@render icon(table.type)}
                            {/if}
                            <span class="search-result">{@html html}</span>
                            {#if i === selectedIndex}
                                <span
                                    class="font-normal text-xs text-fg-1 text-start grow overflow-hidden text-ellipsis"
                                    >{table.column_names.join(", ")}</span
                                >
                                <EnterIcon />
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
    input[type="text"] {
        background-color: transparent;
    }
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
