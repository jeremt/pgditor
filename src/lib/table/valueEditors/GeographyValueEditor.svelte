<script lang="ts">
    import {formatSpatialData, parseSpatialData, spatialDataToHex} from "$lib/helpers/spatialData";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {type PgColumn} from "../pgContext.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    let parsed = {
        get value() {
            return formatSpatialData(parseSpatialData(value));
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
        minRows={1}
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
