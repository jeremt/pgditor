<script lang="ts">
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import UnpluggedIcon from "$lib/icons/UnpluggedIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    import {getPgContext, type PgColumn, type PgRow} from "./pgContext.svelte";
    import TableUpsert from "./TableUpsert.svelte";
    import {createContextMenu} from "./tableContextMenu.svelte";
    import {valueToSql} from "./values";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import TableValueUpdate from "./TableValueUpdate.svelte";

    const pg = getPgContext();

    const {oncontextmenu} = createContextMenu();
    let cell = $state<{element: HTMLElement; row: PgRow; column: PgColumn}>();
</script>

{#if pg.currentTable === undefined}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <UnpluggedIcon --size="3rem" --thickness="1.2" />
        <div>The database is empty or not started.</div>
    </div>
{:else if pg.isLoading}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <ProgressCircle infinite={true} showValue={false} />
    </div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <div>
            <div class="grid items-center px-2 h-10">
                <CheckboxInput
                    checked={pg.selectedRows.length === pg.currentTable.rows.length && pg.currentTable.rows.length > 0}
                    disabled={pg.currentTable.rows.length === 0}
                    indeterminate={pg.selectedRows.length > 0 && pg.selectedRows.length !== pg.currentTable.rows.length}
                    onchange={() => {
                        if (!pg.currentTable || pg.selectedRows.length === pg.currentTable.rows.length) {
                            pg.selectedRows = [];
                        } else {
                            pg.selectedRows = Array.from(new Array(pg.currentTable.rows.length)).map((_, i) => i);
                        }
                    }}
                />
            </div>
            {#each pg.currentTable.rows as row, i (row.__index)}
                <div class="grid items-center px-2 h-10">
                    <CheckboxInput
                        checked={pg.selectedRows.indexOf(i) !== -1}
                        onchange={(e) => {
                            if (e.currentTarget.checked) {
                                pg.selectedRows.push(i);
                            } else {
                                pg.selectedRows.splice(pg.selectedRows.indexOf(i), 1);
                            }
                        }}
                    />
                </div>
            {/each}
        </div>
        <table class="h-fit">
            <thead class="sticky top-0 bg-bg z-10">
                <tr>
                    {#each pg.getSelectedColumns() as column (column.column_name)}
                        <th
                            class="cursor-pointer"
                            onclick={() => {
                                if (pg.filters.orderBy === undefined) {
                                    pg.filters.orderBy = {column: column.column_name, direction: "asc"};
                                } else if (pg.filters.orderBy.column !== column.column_name) {
                                    pg.filters.orderBy = {column: column.column_name, direction: "asc"};
                                } else if (pg.filters.orderBy.direction === "asc") {
                                    pg.filters.orderBy.direction = "desc";
                                } else {
                                    pg.filters.orderBy = undefined;
                                }
                            }}
                        >
                            <div class="flex gap-2 items-center px-1">
                                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
                                {#if column.foreign_table_schema && column.foreign_table_name}
                                    <button
                                        onclick={() =>
                                            pg.use({
                                                schema: column.foreign_table_schema!,
                                                name: column.foreign_table_name!,
                                            })}
                                        title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                        ><LinkIcon --size="1.2rem" /></button
                                    >
                                {/if}
                                <div>
                                    {column.column_name}
                                    <span class="font-normal text-xs! pl-2">{column.data_type}</span>
                                </div>
                                {#if column.column_name === pg.filters.orderBy?.column}
                                    <ArrowIcon direction={pg.filters.orderBy.direction === "asc" ? "top" : "bottom"} />
                                {/if}
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pg.currentTable.rows as row (row.__index)}
                    <tr>
                        {#each pg.getSelectedColumns() as column (column.column_name)}
                            {@const value = row[column.column_name]}
                            <td
                                title={typeof value === "object"
                                    ? JSON.stringify(value)
                                    : value === null
                                      ? "null"
                                      : value.toString()}
                                onclick={(e) => {
                                    if (e.currentTarget instanceof HTMLElement) {
                                        cell = {element: e.currentTarget, column, row: JSON.parse(JSON.stringify(row))};
                                    }
                                }}
                                oncontextmenu={(e) => oncontextmenu(e, column, $state.snapshot(row))}
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
                                        {#if column.foreign_table_schema && column.foreign_table_name && column.foreign_column_name}
                                            <button
                                                class="my-auto cursor-pointer"
                                                onclick={(event) => {
                                                    event.stopPropagation();
                                                    pg.use({
                                                        schema: column.foreign_table_schema!,
                                                        name: column.foreign_table_name!,
                                                    });
                                                    pg.whereFilters = [
                                                        {
                                                            column: column.foreign_column_name!,
                                                            operator: "=",
                                                            value: `${valueToSql(column, value)}`,
                                                        },
                                                    ];
                                                    pg.applyWhere(pg.whereFromFilters());
                                                }}
                                                title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                                ><ArrowIcon direction="right" --size="1rem" /></button
                                            >
                                        {/if}
                                    </div>
                                {/if}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    {#if pg.currentTable.rows.length === 0}
        <div class="text-fg-2 grow">
            <div class="border border-dashed border-bg-2 p-4 w-fit rounded-2xl mx-auto">
                This table doesn't contain any rows, you can use <strong>Insert</strong> to add some!
            </div>
        </div>
    {/if}
{/if}

{#if pg.currentTable && pg.rowToUpdate}
    <Dialog
        --padding="0"
        isOpen={pg.isUpdateOpen}
        onrequestclose={() => (pg.isUpdateOpen = false)}
        position="right"
        animation="right"
    >
        <TableUpsert row={pg.rowToUpdate} onclose={() => (pg.isUpdateOpen = false)} />
    </Dialog>
{/if}
<TableValueUpdate bind:target={cell} />

<style>
    table > tbody > tr > td {
        cursor: pointer;
        transition: 0.1s all;
        &:hover {
            background-color: var(--color-bg-1);
        }
    }
</style>
