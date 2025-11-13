<script lang="ts">
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import UnpluggedIcon from "$lib/icons/UnpluggedIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    import {getTableContext, type PgRow} from "./tableContext.svelte";
    import TableUpsert from "./TableUpsert.svelte";

    const pgTable = getTableContext();

    let rowToUpdate = $derived<PgRow>(
        pgTable.current?.columns.reduce((result, column) => {
            return {...result, [column.column_name]: column.column_default};
        }, {}) ?? {}
    );
    let isUpdateOpen = $state(false);
</script>

{#if pgTable.current === undefined}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <UnpluggedIcon --size="3rem" --thickness="1.2" />
        <div>The database is empty or not started.</div>
    </div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <div>
            <div class="grid items-center px-2 h-10">
                <CheckboxInput
                    checked={pgTable.selectedRows.length === pgTable.current.rows.length &&
                        pgTable.current.rows.length > 0}
                    disabled={pgTable.current.rows.length === 0}
                    indeterminate={pgTable.selectedRows.length > 0 &&
                        pgTable.selectedRows.length !== pgTable.current.rows.length}
                    onchange={() => {
                        if (!pgTable.current || pgTable.selectedRows.length === pgTable.current.rows.length) {
                            pgTable.selectedRows = [];
                        } else {
                            pgTable.selectedRows = Array.from(new Array(pgTable.current.rows.length)).map((_, i) => i);
                        }
                    }}
                />
            </div>
            {#each pgTable.current.rows as _, i}
                <div class="grid items-center px-2 h-10">
                    <CheckboxInput
                        checked={pgTable.selectedRows.indexOf(i) !== -1}
                        onchange={(e) => {
                            if (e.currentTarget.checked) {
                                pgTable.selectedRows.push(i);
                            } else {
                                pgTable.selectedRows.splice(pgTable.selectedRows.indexOf(i), 1);
                            }
                        }}
                    />
                </div>
            {/each}
        </div>
        <table class="h-fit">
            <thead class="sticky top-0 bg-bg">
                <tr>
                    {#each pgTable.current.columns as column}
                        <th>
                            <div class="flex gap-1 items-center px-2">
                                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
                                {#if column.foreign_column_name !== null}
                                    <span
                                        title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                        ><LinkIcon --size="1.2rem" /></span
                                    >
                                {/if}
                                {column.column_name} <span class="font-normal pl-2">{column.data_type}</span>
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pgTable.current.rows as row}
                    <tr
                        onclick={() => {
                            rowToUpdate = row; // TODO: default values
                            isUpdateOpen = true;
                        }}
                    >
                        {#each pgTable.current.columns as column}
                            {@const value = row[column.column_name]}
                            <td>
                                {#if value === null}
                                    NULL
                                {:else if typeof value === "object"}
                                    {JSON.stringify(value)}
                                {:else}
                                    {value}
                                {/if}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if pgTable.current}
    <Dialog isOpen={isUpdateOpen} onrequestclose={() => (isUpdateOpen = false)} position="right" animation="right">
        <TableUpsert row={rowToUpdate} onclose={() => (isUpdateOpen = false)} />
    </Dialog>
{/if}
