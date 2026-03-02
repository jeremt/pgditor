<script lang="ts">
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";

    type Props = {
        offset: number;
        limit: number;
        count: number;
        onchange: (event: Event) => void;
    };
    let {offset = $bindable(), limit = $bindable(), count, onchange}: Props = $props();

    const commands = get_commands_context();
</script>

<label for="limit" class="text-sm pl-2">limit</label>
<NumberInput --width="5rem" id="limit" type="text" step={10} min={0} max={1000} bind:value={limit} {onchange} />
<button
    class="btn icon ghost"
    title="Previous data page {commands.shortcut('Previous data page')}"
    disabled={offset === 0}
    onclick={(event) => {
        offset = Math.max(0, offset - limit);
        onchange(event);
    }}
>
    <ChevronIcon direction="left" />
</button>
<span class="text-sm text-fg-1 text-nowrap">{offset} - {count}</span>
<button
    class="btn icon ghost mr-auto"
    title="Next data page {commands.shortcut('Next data page')}"
    disabled={offset + limit >= count}
    onclick={(event) => {
        offset = Math.min(count ?? 0, offset + limit);
        onchange(event);
    }}
>
    <ChevronIcon direction="right" />
</button>
