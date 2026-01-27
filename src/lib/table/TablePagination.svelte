<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";

    type Props = {
        offset: number;
        limit: number;
        count: number;
    };
    let {offset = $bindable(), limit = $bindable(), count}: Props = $props();
</script>

<label for="limit" class="text-sm pl-2">limit</label>
<NumberInput --width="5rem" id="limit" type="text" step={10} min={0} max={1000} bind:value={limit} />
<button class="btn icon ghost" disabled={offset === 0} onclick={() => (offset = Math.max(0, offset - limit))}>
    <ChevronIcon direction="left" />
</button>
<span class="text-sm text-fg-1 text-nowrap">{offset} - {count}</span>
<button
    class="btn icon ghost mr-auto"
    disabled={offset + limit >= count}
    onclick={() => (offset = Math.min(count ?? 0, offset + limit))}
>
    <ChevronIcon direction="right" />
</button>
