<script lang="ts">
    import ConnectionButton from "$lib/connection/ConnectionButton.svelte";
    import TableButton from "$lib/table/TableButton.svelte";
    import {getTableContext} from "$lib/table/tableContext.svelte";

    const pgTable = getTableContext();
</script>

<header class="flex gap-2 p-4">
    <ConnectionButton />
    <TableButton />
</header>

{#if pgTable.current === undefined}
    <div>No table</div>
{:else}
    <div class="rows">
        <table>
            <thead>
                <tr>
                    {#each pgTable.current.columns as column}
                        <th>
                            <!-- {JSON.stringify(column)} -->
                            {#if column.is_primary_key === "YES"}🔑{/if}
                            {#if column.foreign_column_name !== null}
                                <span
                                    title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                    >🔗</span
                                >
                            {/if}
                            {column.column_name} <span class="type">{column.data_type}</span>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pgTable.current.rows as row}
                    <tr>
                        {#each Object.values(row) as value}
                            <td
                                >{#if value === null}NULL{:else if typeof value === "object"}<pre
                                        style:padding="0"
                                        style:margin-block="0"
                                        style:font-size="0.8rem">{JSON.stringify(
                                            value,
                                            null,
                                            2
                                        )}</pre>{:else}{value}{/if}</td
                            >
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}
