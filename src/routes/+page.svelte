<script lang="ts">
    import ConnectionButton from "$lib/connection/ConnectionButton.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import Table from "$lib/table/Table.svelte";
    import TableSelect from "$lib/table/TableSelect.svelte";
    import {getTableContext, type PgRow} from "$lib/table/tableContext.svelte";
    import TableFilters from "$lib/table/TableFilters.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";
    import TableUpsert from "$lib/table/TableUpsert.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    const pgTable = getTableContext();
    let rowToInsert = $derived<PgRow>(
        pgTable.current?.columns.reduce((result, column) => {
            return {...result, [column.column_name]: column.column_default};
        }, {}) ?? {}
    );
    let isInsertOpen = $state(false);
</script>

<header class="flex gap-2 p-2 items-center w-full overflow-auto">
    <ConnectionButton />
    <TableSelect />

    {#if pgTable.current}
        <TableFilters />
        <label for="limit" class="text-sm pl-2">limit</label>
        <NumberInput
            --width="5rem"
            id="limit"
            type="text"
            step={10}
            min={0}
            max={1000}
            bind:value={pgTable.filters.limit}
        />
        <button
            class="btn icon ghost"
            disabled={pgTable.filters.offset === 0}
            onclick={() => (pgTable.filters.offset -= pgTable.filters.limit)}
        >
            <ChevronIcon direction="left" />
        </button>
        <span class="text-sm text-fg-1 text-nowrap">{pgTable.filters.offset} - {pgTable.current.count}</span>
        <button
            class="btn icon ghost mr-auto"
            disabled={pgTable.filters.offset + pgTable.filters.limit > pgTable.current.count}
            onclick={() => (pgTable.filters.offset += pgTable.filters.limit)}
        >
            <ChevronIcon direction="right" />
        </button>
        {#if pgTable.selectedRows.length > 0}
            <button class="btn ghost"
                ><TrashIcon --size="1.2rem" /> Delete rows
                <span class="badge">{pgTable.selectedRows.length}</span></button
            >
        {/if}
        <button class="btn" onclick={() => (isInsertOpen = true)}><PlusIcon /> Insert row</button>
    {/if}
</header>

<Table />

{#if pgTable.current}
    <Dialog isOpen={isInsertOpen} onrequestclose={() => (isInsertOpen = false)} position="right" animation="right">
        <TableUpsert row={rowToInsert} onclose={() => (isInsertOpen = false)} />
    </Dialog>
{/if}
