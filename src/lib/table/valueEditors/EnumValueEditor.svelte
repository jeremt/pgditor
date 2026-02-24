<script lang="ts">
    import Select from "$lib/widgets/Select.svelte";
    import type {PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();
</script>

<Select class="font-mono font-normal! w-full" id={column.column_name} bind:value>
    {#each column.enum_values as enumValue}
        <option>{enumValue}</option>
    {/each}
</Select>
