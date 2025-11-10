<script lang="ts">
    import Popover from "$lib/widgets/Popover.svelte";
    import {getTableContext} from "./tableContext.svelte";

    const pgTable = getTableContext();

    let isPopoverOpen = $state(false);
    let filterQuery = $state("");
</script>

<Popover isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn outline" onclick={() => (isPopoverOpen = !isPopoverOpen)} disabled={!pgTable.current}>
            {#if pgTable.current}
                {pgTable.current.type === "BASE TABLE" ? "🗃️" : "👁️"}
                {pgTable.current.schema}.{pgTable.current.name}
            {:else}
                no tables
            {/if}
        </button>
    {/snippet}
    <div class="flex flex-col gap-2">
        <input type="text" bind:value={filterQuery} placeholder="Search table" />
        <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
            {#each pgTable.list as table}
                <button
                    class="table-btn"
                    onclick={() => {
                        pgTable.use(table);
                        isPopoverOpen = false;
                    }}
                >
                    {table.type === "BASE TABLE" ? "🗃️" : "👁️"}
                    {table.schema}.{table.name}
                </button>
            {/each}
        </div>
    </div>
</Popover>

<style>
    .table-btn {
        padding: 0.2em 0.4em;
        border-radius: var(--radius-input);
        cursor: pointer;
        text-align: start;
        border: 2px solid transparent;
        &:hover {
            border: 2px solid var(--color-fg);
        }
    }
</style>
