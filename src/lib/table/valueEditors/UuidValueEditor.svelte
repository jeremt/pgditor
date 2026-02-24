<script lang="ts">
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column}: Props = $props();
</script>

<div class="flex gap-2">
    <input
        type="text"
        id={column.column_name}
        class="font-mono! grow"
        autocomplete="off"
        autocapitalize="off"
        bind:value
    />
    <button class="btn secondary" onclick={() => (value = crypto.randomUUID())}><RefreshIcon --size="1rem" /></button>
</div>
