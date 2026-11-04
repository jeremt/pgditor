<script lang="ts">
    import {flip} from "svelte/animate";

    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import GripIcon from "$lib/icons/GripIcon.svelte";
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

    // items are plain values that can repeat, so each one gets a generated key that follows it
    // through moves and removals; keys are regenerated when the array is replaced from outside
    let next_key = 0;
    let keys: number[] = [];
    const keyed_items = $derived.by(() => {
        if (keys.length !== items.length) keys = items.map(() => next_key++);
        return items.map((item, i) => ({item, key: keys[i]}));
    });

    const move = <T,>(list: T[], from: number, to: number) =>
        list.toSpliced(from, 1).toSpliced(to, 0, list[from]);

    const add_item = () => {
        keys = [...keys, next_key++];
        value = [...items, ""];
    };

    const remove_item = (index: number) => {
        keys = keys.toSpliced(index, 1);
        value = items.toSpliced(index, 1);
    };

    let dragged_index = $state<number>();
    let drag_over_index = $state<number>();

    const drop_item = (target_index: number) => {
        const source_index = dragged_index;
        dragged_index = undefined;
        drag_over_index = undefined;
        if (source_index === undefined || source_index === target_index) return;

        keys = move(keys, source_index, target_index);
        value = move(items, source_index, target_index);
    };
</script>

<div class="flex flex-col gap-1">
    {#if typeof value === "string"}
        <div class="text-xs text-fg-1 font-mono">default: {value}</div>
    {/if}
    {#each keyed_items as {item, key}, i (key)}
        <div
            role="listitem"
            class="flex gap-2 rounded"
            class:opacity-50={dragged_index === i}
            class:bg-bg-1={drag_over_index === i && dragged_index !== i}
            animate:flip={{duration: 300}}
            ondragover={(event) => {
                if (dragged_index === undefined) return;
                event.preventDefault();
                drag_over_index = i;
            }}
            ondragleave={() => {
                if (drag_over_index === i) drag_over_index = undefined;
            }}
            ondrop={(event) => {
                event.preventDefault();
                drop_item(i);
            }}
        >
            <button
                class="btn icon ghost cursor-grab"
                type="button"
                draggable="true"
                aria-label="Drag item {i + 1}"
                ondragstart={(event) => {
                    dragged_index = i;
                    event.dataTransfer?.setData("text/plain", String(i));
                }}
                ondragend={() => {
                    dragged_index = undefined;
                    drag_over_index = undefined;
                }}><GripIcon --size="1rem" /></button
            >
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
                onclick={() => remove_item(i)}><CrossIcon --size="1rem" /></button
            >
        </div>
    {/each}
    <button class="btn secondary self-start" type="button" onclick={add_item}>
        <PlusIcon --size="1rem" /> Add item
    </button>
</div>
