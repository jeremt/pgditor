<script lang="ts">
    import {get_pg_context, type WhereFilter, type PgColumn, type PgRow} from "../pg_context.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import SearchIcon from "$lib/icons/SearchIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import TablePagination from "../TablePagination.svelte";
    import TableFilters from "../TableFilters.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    const pg = get_pg_context();

    let isDialogOpen = $state(false);

    let data = $state<{columns: PgColumn[]; rows: PgRow[]; count: number}>();
    let errorMessage = $state<string>();
    let offset = $state(0);
    let limit = $state(100);

    let isFiltersOpen = $state(false);
    let whereFilters = $state<WhereFilter[]>([]);
    let whereSql = $state("");
    let appliedFilters = $state(0);
    const loadData = async () => {
        if (column.foreign_table_schema !== null && column.foreign_table_name !== null) {
            const dataOrError = await pg.get_table_data(
                {schema: column.foreign_table_schema, name: column.foreign_table_name},
                appliedFilters ? whereSql : "",
                offset,
                limit,
            );
            if (dataOrError instanceof Error) {
                errorMessage = dataOrError.message;
                return;
            }
            data = dataOrError;
        }
    };

    $effect(() => {
        loadData();
    });
</script>

{#snippet editor()}
    <div class="flex flex-col w-full h-full">
        <div class="flex flex-col">
            <input
                id={column.column_name}
                class="font-mono! w-full"
                type="text"
                bind:value
                autocomplete="off"
                autocapitalize="off"
            />
            <div class="flex gap-2 items-center pt-2 grow">
                {#if data}
                    <TableFilters
                        bind:isOpen={isFiltersOpen}
                        bind:filters={whereFilters}
                        bind:whereSql
                        {appliedFilters}
                        columns={data.columns}
                        onapply={async () => {
                            appliedFilters = whereFilters.length;
                            isFiltersOpen = false;
                            await loadData();
                        }}
                    />
                    <TablePagination
                        bind:offset
                        bind:limit
                        count={data.count}
                        onchange={() => {
                            loadData();
                        }}
                    />
                {/if}
            </div>
        </div>
        <div class="w-full overflow-auto grow">
            {#if data === undefined}
                <!-- If loading loader else No data -->
            {:else if errorMessage !== undefined}
                <div class="text-error">{errorMessage}</div>
            {:else}
                <table class="h-fit w-full">
                    <thead class="sticky top-0 bg-bg z-10">
                        <tr>
                            {#each data.columns as column (column.column_name)}
                                <th>
                                    <div class="flex gap-2 items-center px-1">
                                        {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
                                        {#if column.foreign_table_schema && column.foreign_table_name}
                                            <LinkIcon --size="1.2rem" />
                                        {/if}
                                        <div>
                                            {column.column_name}
                                            <span class="font-normal text-xs! pl-2">{column.data_type}</span>
                                        </div>
                                    </div>
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.rows as row (row.__index)}
                            <tr
                                onclick={() => {
                                    const pk = data?.columns.find((column) => column.is_primary_key === "YES");
                                    if (pk) {
                                        value = row[pk.column_name]?.toString() ?? value;
                                    }
                                }}
                            >
                                {#each data.columns as column (column.column_name)}
                                    {@const value = row[column.column_name]}
                                    <td
                                        title={typeof value === "object"
                                            ? JSON.stringify(value)
                                            : value === null
                                              ? "null"
                                              : value.toString()}
                                    >
                                        {#if value === null}
                                            null
                                        {:else if typeof value === "object"}
                                            {JSON.stringify(value).slice(0, 50)}
                                        {:else}
                                            <div class="flex gap-2 items-center">
                                                <span class="grow"
                                                    >{typeof value === "string" ? value.slice(0, 50) : value}</span
                                                >
                                            </div>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </div>
{/snippet}

{#if inlined}
    <div class="flex gap-2">
        <input
            id={column.column_name}
            class="font-mono! grow"
            type="text"
            bind:value
            autocomplete="off"
            autocapitalize="off"
        />
        <button class="btn secondary" onclick={() => (isDialogOpen = true)}><SearchIcon --size="1rem" /></button>
    </div>
    <Dialog isOpen={isDialogOpen} position="right" animation="right">
        <div class="flex flex-col w-xl h-full">
            <header class="flex flex-col pt-4 px-4">
                <div class="flex gap-2 items-center pb-4">
                    <h2 class="flex gap-2 ms-2 me-auto items-center">
                        <LinkIcon --size="1.2rem" />
                        {column.column_name}
                        <span class="font-normal">{column.data_type}</span>
                    </h2>
                    <button class="btn" onclick={() => (isDialogOpen = false)}
                        ><CheckIcon --size="1.2rem" /> Apply</button
                    >
                </div>
            </header>
            <div class="grow px-4 w-full overflow-auto">
                {@render editor()}
            </div>
        </div>
    </Dialog>
{:else}
    {@render editor()}
{/if}

<style>
    table > tbody > tr {
        cursor: pointer;
        transition: 0.1s all;
        &:hover {
            background-color: var(--color-bg-1);
        }
    }
</style>
