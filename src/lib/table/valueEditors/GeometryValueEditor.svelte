<script lang="ts">
    import {catch_error} from "$lib/helpers/catch_error";
    import {format_geometry_data, type GeoJSONGeometry} from "$lib/helpers/geometry_data";
    import Mapbox from "$lib/widgets/Mapbox.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: GeoJSONGeometry | string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    let value_to_spot = {
        get value() {
            if (typeof value === "string") {
                const coords = value
                    .slice("Point(".length, value.length - 1)
                    .split(" ")
                    .map(Number)
                    .filter((n) => !isNaN(n));
                if (coords.length !== 2) {
                    ({
                        kind: "point",
                        name: "Invalid point",
                        lon: 0,
                        lat: 0,
                    }) as const;
                }
                return {
                    kind: "point",
                    name: value,
                    lon: coords[0],
                    lat: coords[1],
                } as const;
            }
            console.log(value);
            return value.type !== "Point"
                ? ({
                      kind: "point",
                      name: "Unsupported geometry type",
                      lon: 0,
                      lat: 0,
                  } as const)
                : ({
                      kind: "point",
                      name: `Point(${value.coordinates[0]} ${value.coordinates[1]})`,
                      lon: value.coordinates[0],
                      lat: value.coordinates[1],
                  } as const);
        },
        set value(newValue) {
            value = {
                type: "Point",
                coordinates: [newValue.lon, newValue.lat],
            } satisfies GeoJSONGeometry;
        },
    };

    let value_to_text = {
        get value() {
            const newValue = catch_error(() => (typeof value === "string" ? value : format_geometry_data(value)));
            if (newValue instanceof Error) {
                console.warn(newValue.message);
                return "";
            }
            return newValue;
        },
        set value(newValue) {
            value = newValue;
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
