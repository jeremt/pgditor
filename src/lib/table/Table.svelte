<script lang="ts">
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import UnpluggedIcon from "$lib/icons/UnpluggedIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    import {filters_to_where, get_pg_context, type PgColumn, type PgRow} from "./pgContext.svelte";
    import TableUpsert from "./TableUpsert.svelte";
    import {createContextMenu} from "./tableContextMenu.svelte";
    import {valueToSql} from "./values";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import TableValueUpdate from "./TableValueUpdate.svelte";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {getToastContext} from "$lib/widgets/Toaster.svelte";
    import {formatSpatialData, parseSpatialData} from "$lib/helpers/spatialData";
    import {formatGeometryData, type GeoJSONGeometry} from "$lib/helpers/geometryData";

    const pg = get_pg_context();

    const {toast} = getToastContext();
    const {oncontextmenu} = createContextMenu();
    let cell = $state<{element: HTMLElement; row: PgRow; column: PgColumn}>();
    let lastCheckedIndex: number | null = null;
</script>

{#if pg.current_table === undefined}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <UnpluggedIcon --size="3rem" --thickness="1.2" />
        <div>The database is empty or not started.</div>
    </div>
{:else if pg.is_loading}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <ProgressCircle infinite={true} showValue={false} />
    </div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <div>
            <div class="grid items-center px-2 h-10">
                <CheckboxInput
                    checked={pg.selected_rows.length === pg.current_table.rows.length &&
                        pg.current_table.rows.length > 0}
                    disabled={pg.current_table.rows.length === 0}
                    indeterminate={pg.selected_rows.length > 0 &&
                        pg.selected_rows.length !== pg.current_table.rows.length}
                    onchange={() => {
                        if (!pg.current_table || pg.selected_rows.length === pg.current_table.rows.length) {
                            pg.selected_rows = [];
                        } else {
                            pg.selected_rows = Array.from(new Array(pg.current_table.rows.length)).map((_, i) => i);
                        }
                    }}
                />
            </div>
            {#each pg.current_table.rows as row, i (row.__index)}
                <div class="grid items-center px-2 h-10">
                    <CheckboxInput
                        checked={pg.selected_rows.indexOf(i) !== -1}
                        onclick={(e) => {
                            const isChecked = e.currentTarget.checked;
                            const isShiftPressed = e.shiftKey;

                            if (isShiftPressed && lastCheckedIndex !== null) {
                                // Determine the range (works both top-to-bottom and bottom-to-top)
                                const start = Math.min(lastCheckedIndex, i);
                                const end = Math.max(lastCheckedIndex, i);

                                for (let j = start; j <= end; j++) {
                                    const alreadySelected = pg.selected_rows.indexOf(j) !== -1;

                                    if (isChecked && !alreadySelected) {
                                        pg.selected_rows.push(j);
                                    } else if (!isChecked && alreadySelected) {
                                        // Gmail also supports Shift+Deselect!
                                        pg.selected_rows.splice(pg.selected_rows.indexOf(j), 1);
                                    }
                                }
                            } else {
                                // Standard single-click logic
                                if (isChecked) {
                                    pg.selected_rows.push(i);
                                } else {
                                    pg.selected_rows.splice(pg.selected_rows.indexOf(i), 1);
                                }
                            }

                            // 2. Update the reference for the next shift-click
                            lastCheckedIndex = i;
                        }}
                    />
                </div>
            {/each}
        </div>
        <table class="h-fit">
            <thead class="sticky top-0 bg-bg z-10">
                <tr>
                    {#each pg.get_selected_columns() as column (column.column_name)}
                        <th
                            class="cursor-pointer"
                            onclick={() => {
                                if (pg.order_by === undefined) {
                                    pg.order_by = {column: column.column_name, direction: "asc"};
                                } else if (pg.order_by.column !== column.column_name) {
                                    pg.order_by = {column: column.column_name, direction: "asc"};
                                } else if (pg.order_by.direction === "asc") {
                                    pg.order_by.direction = "desc";
                                } else {
                                    pg.order_by = undefined;
                                }
                                pg.refresh_data();
                            }}
                        >
                            <div class="flex gap-2 items-center px-1">
                                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.1rem" />{/if}
                                {#if column.foreign_table_schema && column.foreign_table_name}
                                    <button
                                        onclick={() =>
                                            pg.select_table({
                                                schema: column.foreign_table_schema!,
                                                name: column.foreign_table_name!,
                                            })}
                                        title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                        ><LinkIcon --size="1.2rem" /></button
                                    >
                                {/if}
                                <div>
                                    {column.column_name}
                                    <span class="font-normal text-xs! pl-2"
                                        >{column.data_type}{#if column.data_type_params}{column.data_type_params}{/if}</span
                                    >
                                </div>
                                {#if column.column_name === pg.order_by?.column}
                                    <ArrowIcon direction={pg.order_by.direction === "asc" ? "top" : "bottom"} />
                                {/if}
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pg.current_table.rows as row (row.__index)}
                    <tr>
                        {#each pg.get_selected_columns() as column (column.column_name)}
                            {@const value = row[column.column_name]}
                            <td
                                class:text-fg-2={value === null}
                                title={column.data_type === "geography"
                                    ? formatSpatialData(parseSpatialData(value as string))
                                    : column.data_type === "geometry"
                                      ? formatGeometryData(value as GeoJSONGeometry)
                                      : typeof value === "object"
                                        ? JSON.stringify(value)
                                        : value === null
                                          ? "null"
                                          : value.toString()}
                                onclick={async (e) => {
                                    if (pg.current_table?.type === "BASE TABLE") {
                                        if (e.currentTarget instanceof HTMLElement) {
                                            cell = {
                                                element: e.currentTarget,
                                                column,
                                                row: JSON.parse(JSON.stringify(row)),
                                            };
                                        }
                                    } else if (pg.current_table?.type === "VIEW") {
                                        await writeText(row[column.column_name]?.toString() ?? "null");
                                        toast("Value copied to clipboard");
                                    }
                                }}
                                oncontextmenu={(e) => oncontextmenu(e, column, $state.snapshot(row))}
                            >
                                {#if value === null}
                                    null
                                {:else if column.data_type === "geometry"}
                                    {formatGeometryData(value as GeoJSONGeometry)}
                                {:else if typeof value === "object"}
                                    {JSON.stringify(value).slice(0, 50)}
                                {:else if column.data_type === "geography"}
                                    {formatSpatialData(parseSpatialData(value as string))}
                                {:else}
                                    <div class="flex gap-2 items-center">
                                        <span class="grow"
                                            >{typeof value === "string" ? value.slice(0, 50) : value}</span
                                        >
                                        {#if column.foreign_table_schema && column.foreign_table_name && column.foreign_column_name}
                                            <button
                                                class="my-auto cursor-pointer"
                                                onclick={async (event) => {
                                                    event.stopPropagation();
                                                    await pg.select_table({
                                                        schema: column.foreign_table_schema!,
                                                        name: column.foreign_table_name!,
                                                    });
                                                    pg.where_filters = [
                                                        {
                                                            column: column.foreign_column_name!,
                                                            column_type: column.data_type,
                                                            operator: "=",
                                                            value: `${valueToSql(column, value)}`,
                                                        },
                                                    ];
                                                    pg.where_sql = filters_to_where(pg.where_filters).trim();
                                                    pg.applied_filters = pg.where_filters.length;
                                                    await pg.refresh_data();
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
    {#if pg.current_table.rows.length === 0}
        <div class="fixed top-1/2 w-full flex justify-center pointer-events-none">
            <div class="border border-dashed border-bg-2 p-4 w-fit rounded-2xl">
                This table doesn't contain any rows, you can use <strong>Insert</strong> to add some!
            </div>
        </div>
    {/if}
{/if}

{#if pg.current_table && pg.row_to_update}
    <Dialog
        --padding="0"
        isOpen={pg.is_update_open}
        onrequestclose={() => (pg.is_update_open = false)}
        position="right"
        animation="right"
    >
        <TableUpsert row={pg.row_to_update} onclose={() => (pg.is_update_open = false)} />
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
