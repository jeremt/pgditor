<script lang="ts">
    import {format_geometry_data, type GeoJSONGeometry} from "$lib/helpers/geometry_data";
    import {format_spatial_data, parse_spatial_data} from "$lib/helpers/spatial_data";
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import {filters_to_where, get_pg_context, type PgColumn, type PgRow, type PgValue} from "./pg_context.svelte";

    type Props = {
        value: PgValue;
        column: PgColumn;
        row: PgRow;
        oncontextmenu: (e: MouseEvent, column: PgColumn, row: PgRow) => void;
        onclick: (event: MouseEvent & {currentTarget: HTMLElement}) => void;
    };

    const {value, column, row, oncontextmenu, onclick}: Props = $props();

    const pg = get_pg_context();

    const fast_preview_json_value = (value: unknown, budget = 50): string => {
        if (value === null) return "null";
        if (typeof value === "boolean") return String(value);
        if (typeof value === "number") return String(value);
        if (typeof value === "string") {
            return value.length > budget ? value.slice(0, budget) + "..." : value;
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return "[]";
            let result = "[";
            for (const item of value) {
                if (result.length >= budget) {
                    result += "...";
                    break;
                }
                const preview = fast_preview_json_value(item, budget - result.length);
                result += preview + ", ";
            }
            return result.replace(/, $/, "") + "]";
        }
        if (typeof value === "object") {
            const entries = Object.entries(value);
            if (entries.length === 0) return "{}";
            let result = "{";
            for (const [k, v] of entries) {
                if (result.length >= budget) {
                    result += "...";
                    break;
                }
                const preview = fast_preview_json_value(v, budget - result.length);
                result += `${k}: ${preview}, `;
            }
            return result.replace(/, $/, "") + "}";
        }
        return String(value);
    };
</script>

<td class:text-fg-2={value === null} {onclick} oncontextmenu={(e) => oncontextmenu(e, column, $state.snapshot(row))}>
    {#if value === null}
        null
    {:else if column.data_type === "geometry"}
        {format_geometry_data(value as GeoJSONGeometry)}
    {:else if typeof value === "object"}
        {fast_preview_json_value(value)}
    {:else if column.data_type === "geography"}
        {format_spatial_data(parse_spatial_data(value as string))}
    {:else}
        <div class="flex gap-2 items-center">
            <span class="grow">{typeof value === "string" ? value.slice(0, 50) : value}</span>
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
                                value: `${value}`,
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

<style>
    td {
        cursor: pointer;
        transition: 0.1s all;
        &:hover {
            background-color: var(--color-bg-1);
        }
    }
</style>
