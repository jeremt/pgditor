<script lang="ts">
    import ConnectionButton from "$lib/connection/ConnectionButton.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import Table from "$lib/table/Table.svelte";
    import TableButton from "$lib/table/TableButton.svelte";
    import {getTableContext} from "$lib/table/tableContext.svelte";
    import TableFilters from "$lib/table/TableFilters.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";

    const pgTable = getTableContext();
</script>

<header class="flex gap-2 p-2 items-center">
    <ConnectionButton />
    <TableButton />

    {#if pgTable.current}
        <TableFilters />
        <button
            class="btn icon"
            disabled={pgTable.filters.offset === 0}
            onclick={() => (pgTable.filters.offset -= pgTable.filters.limit)}
        >
            <ChevronIcon direction="left" />
        </button>
        <button
            class="btn icon"
            disabled={pgTable.filters.offset + pgTable.filters.limit > pgTable.current.count}
            onclick={() => (pgTable.filters.offset += pgTable.filters.limit)}
        >
            <ChevronIcon direction="right" />
        </button>
        <label for="limit">limit</label>
        <NumberInput --width="5rem" id="limit" type="text" bind:value={pgTable.filters.limit} />
        <span>{pgTable.filters.offset} - {pgTable.current.count}</span>
    {/if}
</header>

<Table />
