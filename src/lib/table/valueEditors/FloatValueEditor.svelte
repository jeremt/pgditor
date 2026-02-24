<script lang="ts">
    import NumberInput from "$lib/widgets/NumberInput.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: number;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column}: Props = $props();
</script>

<NumberInput id={column.column_name} autocomplete="off" autocapitalize="off" bind:value step={0.01} />
