<script lang="ts">
    import {getTableContext} from "./tableContext.svelte";

    const pgTable = getTableContext();
</script>

{#if pgTable.current === undefined}
    <div>No table</div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <table class="h-fit">
            <thead>
                <tr>
                    {#each pgTable.current.columns as column}
                        <th>
                            {#if column.is_primary_key === "YES"}🔑{/if}
                            {#if column.foreign_column_name !== null}
                                <span
                                    title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                    >🔗</span
                                >
                            {/if}
                            {column.column_name} <span class="text-xs font-normal pl-2">{column.data_type}</span>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pgTable.current.rows as row}
                    <tr>
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
