<script lang="ts">
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import {type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: unknown;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column}: Props = $props();

    // an expression default (e.g. `array['a']`) is a string, it is kept until the user edits the array
    const items = $derived(Array.isArray(value) ? (value as unknown[]) : []);
</script>

<div class="flex flex-col gap-1">
    {#if typeof value === "string"}
        <div class="text-xs text-fg-1 font-mono">default: {value}</div>
    {/if}
    {#each items as item, i}
        <div class="flex gap-2">
            <input
                type="text"
                id={i === 0 ? column.column_name : undefined}
                class="font-mono! grow"
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="NULL"
                value={item ?? ""}
                oninput={(event) => (value = items.with(i, event.currentTarget.value))}
            />
            <button
                class="btn icon ghost"
                type="button"
                aria-label="Remove item"
                onclick={() => (value = items.toSpliced(i, 1))}><CrossIcon --size="1rem" /></button
            >
        </div>
    {/each}
    <button class="btn secondary self-start" type="button" onclick={() => (value = [...items, ""])}>
        <PlusIcon --size="1rem" /> Add item
    </button>
</div>
