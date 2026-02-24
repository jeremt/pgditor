<script lang="ts">
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();
</script>

{#if inlined}
    <MultilinesInput
        id={column.column_name}
        class="font-mono!"
        autocomplete="off"
        autocapitalize="off"
        minRows={1}
        bind:value
    />
{:else}
    <textarea
        id={column.column_name}
        class="font-mono! w-full h-full! py-2"
        autocomplete="off"
        autocapitalize="off"
        bind:value
    ></textarea>
{/if}
