<script lang="ts">
    import {catch_error} from "$lib/helpers/catch_error";
    import {formatSpatialData, parseSpatialData, spatialDataToHex} from "$lib/helpers/spatial_data";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    let parsed = {
        get value() {
            const newValue = catch_error(() => formatSpatialData(parseSpatialData(value)));
            if (newValue instanceof Error) {
                console.warn(newValue.message);
                return "";
            }
            return newValue;
        },
        set value(newValue) {
            value = spatialDataToHex(newValue);
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
        bind:value={parsed.value}
    />
{:else}
    <textarea
        id={column.column_name}
        class="font-mono! w-full h-full! py-2"
        autocomplete="off"
        autocapitalize="off"
        bind:value={parsed.value}
    ></textarea>
{/if}
