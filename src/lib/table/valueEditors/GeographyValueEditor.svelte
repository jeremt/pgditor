<script lang="ts">
    import {catch_error} from "$lib/helpers/catch_error";
    import {format_spatial_data, parse_spatial_data, spatial_data_to_Hex} from "$lib/helpers/spatial_data";
    import Mapbox from "$lib/widgets/Mapbox.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    const spots = $derived.by(() => {
        const data = catch_error(() => parse_spatial_data(value));
        if (data instanceof Error) {
            console.warn(data.message);
            return [];
        }
        if (data && data.type === "Point") {
            return [
                {
                    kind: "point",
                    name: format_spatial_data(data),
                    lon: data.coordinates.lng,
                    lat: data.coordinates.lat,
                } as const,
            ];
        }
        return [];
    });

    let value_to_spot = {
        get value() {
            const newValue = catch_error(() => parse_spatial_data(value));
            if (newValue instanceof Error) {
                console.warn(newValue.message);
                return {
                    kind: "point",
                    name: "Invalid point",
                    lon: 0,
                    lat: 0,
                } as const;
            }
            if (newValue && newValue.type === "Point") {
                return {
                    kind: "point",
                    name: format_spatial_data(newValue),
                    lon: newValue.coordinates.lng,
                    lat: newValue.coordinates.lat,
                } as const;
            }
            return {
                kind: "point",
                name: "Unhandled geometry type",
                lon: 0,
                lat: 0,
            } as const;
        },
        set value(newValue) {
            value = spatial_data_to_Hex(`Point(${newValue.lon} ${newValue.lat})`);
        },
    };

    let value_to_text = {
        get value() {
            const newValue = catch_error(() => format_spatial_data(parse_spatial_data(value)));
            if (newValue instanceof Error) {
                console.warn(newValue.message);
                return "";
            }
            return newValue;
        },
        set value(newValue) {
            value = spatial_data_to_Hex(newValue);
        },
    };
</script>

{#if inlined}
    <MultilinesInput
        id={column.column_name}
        class="font-mono!"
        autocomplete="off"
        autocapitalize="off"
        min_rows={1}
        bind:value={value_to_text.value}
    />
{:else}
    <div class="flex flex-col h-full gap-4">
        <input
            id={column.column_name}
            type="text"
            class="font-mono! w-full py-2"
            autocomplete="off"
            autocapitalize="off"
            bind:value={value_to_text.value}
        />
        <div class="w-full grow">
            <Mapbox bind:spot={value_to_spot.value} />
        </div>
    </div>
{/if}
